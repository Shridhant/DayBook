import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { sql } from "@/lib/db";
import { timeToMinutes, type Weekday } from "@/lib/time";

/**
 * Public catalog for the booking flow and the landing page: services, staff, hours.
 * Changes only when the owner edits it, so it's cached (AGENTS.md §5) and the admin invalidates
 * CATALOG_TAG after every write.
 */

export const CATALOG_TAG = "catalog";

export type CatalogService = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categoryId: string;
  pricePaise: number;
  priceIsFrom: boolean;
  durationMin: number;
};

export type CatalogStaff = {
  id: string;
  slug: string;
  name: string;
  specialties: string | null;
  photoPath: string | null;
  serviceIds: string[];
};

export type Catalog = {
  categories: { id: string; slug: string; name: string }[];
  services: CatalogService[];
  staff: CatalogStaff[];
  /** Opening hours by weekday (0 = Sunday); missing = closed. Minutes since IST midnight. */
  openingHours: Partial<Record<Weekday, { opens: number; closes: number }>>;
  /** Upcoming whole-day closures, "YYYY-MM-DD". */
  closures: string[];
  bookingWindowDays: number;
  cancelWindowHours: number;
};

export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const [categories, services, staff, skills, hours, closures, [settings]] = await Promise.all([
    sql<{ id: string; slug: string; name: string }[]>`
      select id, slug, name from service_categories
      where exists (select 1 from services s where s.category_id = service_categories.id and s.active)
      order by sort_order, name`,
    sql<{ id: string; slug: string; name: string; description: string | null; category_id: string;
          price_paise: number; price_is_from: boolean; duration_min: number }[]>`
      select s.id, s.slug, s.name, s.description, s.category_id, s.price_paise, s.price_is_from, s.duration_min
      from services s join service_categories c on c.id = s.category_id
      where s.active order by c.sort_order, s.sort_order, s.name`,
    sql<{ id: string; slug: string; name: string; specialties: string | null; photo_path: string | null }[]>`
      select id, slug, name, specialties, photo_path from staff where active order by sort_order, name`,
    sql<{ staff_id: string; service_id: string }[]>`
      select ss.staff_id, ss.service_id from staff_services ss
      join staff st on st.id = ss.staff_id and st.active
      join services sv on sv.id = ss.service_id and sv.active`,
    sql<{ weekday: Weekday; opens_at: string; closes_at: string }[]>`select weekday, opens_at, closes_at from opening_hours`,
    sql<{ date: string }[]>`
      select to_char(date, 'YYYY-MM-DD') as date from salon_closures
      where date >= (now() at time zone 'Asia/Kolkata')::date - 1 order by date`,
    sql<{ booking_window_days: number; cancel_window_hours: number }[]>`
      select booking_window_days, cancel_window_hours from settings`,
  ]);

  return {
    categories,
    services: services.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      description: s.description,
      categoryId: s.category_id,
      pricePaise: s.price_paise,
      priceIsFrom: s.price_is_from,
      durationMin: s.duration_min,
    })),
    staff: staff.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      specialties: s.specialties,
      photoPath: s.photo_path,
      serviceIds: skills.filter((k) => k.staff_id === s.id).map((k) => k.service_id),
    })),
    openingHours: Object.fromEntries(
      hours.map((h) => [h.weekday, { opens: timeToMinutes(h.opens_at), closes: timeToMinutes(h.closes_at) }]),
    ),
    closures: closures.map((c) => c.date),
    bookingWindowDays: settings.booking_window_days,
    cancelWindowHours: settings.cancel_window_hours,
  };
}
