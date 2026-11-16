import "server-only";
import type { TransactionSql } from "postgres";
import { sql } from "@/lib/db";
import { deleteUpload } from "../uploads";
import { AdminError, notFound, refreshPublic } from "./http";
import { uniqueSlug } from "./staff-admin";

/** Services, prices and categories (owner only). Existing bookings keep their snapshotted prices. */

export type AdminService = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  pricePaise: number;
  priceIsFrom: boolean;
  durationMin: number;
  bookingAmountOverridePaise: number | null;
  active: boolean;
  sortOrder: number;
  staffIds: string[];
  imagePath: string | null;
};

export type AdminCategory = { id: string; name: string; sortOrder: number; serviceCount: number };

export async function listServicesAdmin(): Promise<{ categories: AdminCategory[]; services: AdminService[] }> {
  const [categories, services] = await Promise.all([
    sql<{ id: string; name: string; sort_order: number; service_count: number }[]>`
      select c.id, c.name, c.sort_order, (select count(*)::int from services s where s.category_id = c.id) as service_count
      from service_categories c order by c.sort_order, c.name`,
    sql<
      { id: string; category_id: string; name: string; description: string | null; price_paise: number; price_is_from: boolean;
        duration_min: number; booking_amount_override_paise: number | null; active: boolean; sort_order: number; staff_ids: string[] | null;
        image_path: string | null }[]
    >`
      select s.*, (select array_agg(ss.staff_id) from staff_services ss where ss.service_id = s.id) as staff_ids
      from services s order by s.sort_order, s.name`,
  ]);
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sort_order, serviceCount: c.service_count })),
    services: services.map((s) => ({
      id: s.id,
      categoryId: s.category_id,
      name: s.name,
      description: s.description,
      pricePaise: s.price_paise,
      priceIsFrom: s.price_is_from,
      durationMin: s.duration_min,
      bookingAmountOverridePaise: s.booking_amount_override_paise,
      active: s.active,
      sortOrder: s.sort_order,
      staffIds: s.staff_ids ?? [],
      imagePath: s.image_path,
    })),
  };
}

export type ServiceInput = {
  categoryId: string;
  name: string;
  description?: string | null;
  pricePaise: number;
  priceIsFrom: boolean;
  durationMin: number;
  bookingAmountOverridePaise: number | null;
  active: boolean;
  /** Artists who can do this service; replaces the current list. */
  staffIds: string[];
  imagePath: string | null;
};

async function assertCategory(categoryId: string) {
  const [row] = await sql`select 1 from service_categories where id = ${categoryId}`;
  if (!row) throw new AdminError(400, "invalid_request", "Choose a category.", "categoryId");
}

async function writeServiceStaff(tx: TransactionSql, serviceId: string, staffIds: string[]) {
  await tx`delete from staff_services where service_id = ${serviceId}`;
  if (staffIds.length) await tx`insert into staff_services ${tx(staffIds.map((staff_id) => ({ staff_id, service_id: serviceId })))}`;
}

export async function createService(input: ServiceInput): Promise<{ id: string }> {
  await assertCategory(input.categoryId);
  const slug = await uniqueSlug("services", input.name);
  const id = await sql.begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      insert into services (category_id, name, slug, description, price_paise, price_is_from, duration_min,
                            booking_amount_override_paise, active, image_path, sort_order)
      values (${input.categoryId}, ${input.name}, ${slug}, ${input.description || null}, ${input.pricePaise}, ${input.priceIsFrom},
              ${input.durationMin}, ${input.bookingAmountOverridePaise}, ${input.active}, ${input.imagePath},
              (select coalesce(max(sort_order), 0) + 1 from services where category_id = ${input.categoryId}))
      returning id`;
    await writeServiceStaff(tx, row.id, input.staffIds);
    return row.id;
  });
  refreshPublic("catalog");
  return { id };
}

export async function updateService(id: string, input: ServiceInput) {
  await assertCategory(input.categoryId);
  const [current] = await sql<{ name: string; image_path: string | null }[]>`select name, image_path from services where id = ${id}`;
  if (!current) throw notFound("Service");
  const slug = input.name !== current.name ? await uniqueSlug("services", input.name, id) : null;
  await sql.begin(async (tx) => {
    await tx`
      update services set
        category_id = ${input.categoryId}, name = ${input.name}, slug = coalesce(${slug}, slug),
        description = ${input.description || null}, price_paise = ${input.pricePaise}, price_is_from = ${input.priceIsFrom},
        duration_min = ${input.durationMin}, booking_amount_override_paise = ${input.bookingAmountOverridePaise},
        active = ${input.active}, image_path = ${input.imagePath}
      where id = ${id}`;
    await writeServiceStaff(tx, id, input.staffIds);
  });
  if (current.image_path !== input.imagePath) await deleteUpload(current.image_path);
  refreshPublic("catalog");
}

/** Services with bookings can't be deleted (history keeps them); hide them instead. */
export async function deleteService(id: string) {
  const [used] = await sql`select 1 from booking_items where service_id = ${id} limit 1`;
  if (used) throw new AdminError(409, "in_use", "This service has bookings. Hide it instead of deleting it.");
  const [row] = await sql<{ image_path: string | null }[]>`delete from services where id = ${id} returning image_path`;
  if (!row) throw notFound("Service");
  await deleteUpload(row.image_path);
  refreshPublic("catalog");
}

export async function moveService(id: string, direction: "up" | "down") {
  await sql.begin(async (tx) => {
    const [current] = await tx<{ category_id: string; sort_order: number }[]>`select category_id, sort_order from services where id = ${id}`;
    if (!current) throw notFound("Service");
    const [neighbour] = await tx<{ id: string; sort_order: number }[]>`
      select id, sort_order from services where category_id = ${current.category_id} and id <> ${id}
        and ${direction === "up" ? tx`sort_order <= ${current.sort_order}` : tx`sort_order >= ${current.sort_order}`}
      order by sort_order ${direction === "up" ? tx`desc` : tx`asc`}, name limit 1`;
    if (!neighbour) return;
    // Swap; if both share a number, nudge so the order actually changes.
    const nextOrder = neighbour.sort_order === current.sort_order ? current.sort_order + (direction === "up" ? -1 : 1) : neighbour.sort_order;
    await tx`update services set sort_order = ${current.sort_order} where id = ${neighbour.id}`;
    await tx`update services set sort_order = ${nextOrder} where id = ${id}`;
  });
  refreshPublic("catalog");
}

export async function createCategory(name: string): Promise<{ id: string }> {
  const slug = await uniqueSlug("service_categories", name);
  const [row] = await sql<{ id: string }[]>`
    insert into service_categories (name, slug, sort_order)
    values (${name}, ${slug}, (select coalesce(max(sort_order), 0) + 1 from service_categories)) returning id`;
  refreshPublic("catalog");
  return row;
}

export async function updateCategory(id: string, input: { name?: string; sortOrder?: number }) {
  const [row] = await sql`
    update service_categories set name = coalesce(${input.name ?? null}, name), sort_order = coalesce(${input.sortOrder ?? null}, sort_order)
    where id = ${id} returning id`;
  if (!row) throw notFound("Category");
  refreshPublic("catalog", "content");
}

export async function deleteCategory(id: string) {
  const [used] = await sql`select 1 from services where category_id = ${id} limit 1`;
  if (used) throw new AdminError(409, "in_use", "Move or delete this category's services first.");
  const [row] = await sql`delete from service_categories where id = ${id} returning id`;
  if (!row) throw notFound("Category");
  refreshPublic("catalog", "content");
}
