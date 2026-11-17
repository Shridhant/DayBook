import "server-only";
import { sql } from "@/lib/db";
import { parseInstagramUrl } from "@/lib/instagram";
import { deleteUpload } from "../uploads";
import { AdminError, notFound, refreshPublic } from "./http";

/** Website content (owner + front desk): portfolio photos, Instagram posts, testimonials. */

type ContentTable = "portfolio_items" | "instagram_posts" | "testimonials";

/** Swaps an item with its neighbour in sort order. Table names are hard-coded by callers. */
export async function moveContent(table: ContentTable, id: string, direction: "up" | "down") {
  await sql.begin(async (tx) => {
    const [current] = await tx<{ sort_order: number }[]>`select sort_order from ${tx(table)} where id = ${id}`;
    if (!current) throw notFound();
    const [neighbour] = await tx<{ id: string; sort_order: number }[]>`
      select id, sort_order from ${tx(table)} where id <> ${id}
        and ${direction === "up" ? tx`sort_order <= ${current.sort_order}` : tx`sort_order >= ${current.sort_order}`}
      order by sort_order ${direction === "up" ? tx`desc` : tx`asc`}, created_at limit 1`;
    if (!neighbour) return;
    const nextOrder = neighbour.sort_order === current.sort_order ? current.sort_order + (direction === "up" ? -1 : 1) : neighbour.sort_order;
    await tx`update ${tx(table)} set sort_order = ${current.sort_order} where id = ${neighbour.id}`;
    await tx`update ${tx(table)} set sort_order = ${nextOrder} where id = ${id}`;
  });
  refreshPublic("content");
}

/* ---------- Portfolio ---------- */

export type AdminPortfolioItem = {
  id: string;
  imagePath: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  categoryId: string | null;
  featured: boolean;
  active: boolean;
};

export async function listPortfolioAdmin(): Promise<AdminPortfolioItem[]> {
  return sql<AdminPortfolioItem[]>`
    select id, image_path as "imagePath", width, height, alt, caption, category_id as "categoryId", featured, active
    from portfolio_items order by sort_order, created_at desc`;
}

export type PortfolioInput = { alt: string; caption?: string | null; categoryId?: string | null; featured: boolean; active: boolean };

export async function createPortfolioItem(image: { path: string; width: number; height: number }, input: PortfolioInput) {
  if (!image.path.startsWith("/uploads/portfolio/")) throw new AdminError(400, "invalid_request", "Upload the photo first.");
  const [row] = await sql<{ id: string }[]>`
    insert into portfolio_items (image_path, width, height, alt, caption, category_id, featured, active, sort_order)
    values (${image.path}, ${image.width}, ${image.height}, ${input.alt}, ${input.caption || null}, ${input.categoryId || null},
            ${input.featured}, ${input.active}, (select coalesce(min(sort_order), 1) - 1 from portfolio_items))
    returning id`;
  refreshPublic("content");
  return row;
}

export async function updatePortfolioItem(id: string, input: PortfolioInput) {
  const [row] = await sql`
    update portfolio_items set alt = ${input.alt}, caption = ${input.caption || null}, category_id = ${input.categoryId || null},
      featured = ${input.featured}, active = ${input.active}
    where id = ${id} returning id`;
  if (!row) throw notFound("Photo");
  refreshPublic("content");
}

export async function deletePortfolioItem(id: string) {
  const [row] = await sql<{ image_path: string }[]>`delete from portfolio_items where id = ${id} returning image_path`;
  if (!row) throw notFound("Photo");
  await deleteUpload(row.image_path);
  refreshPublic("content");
}

/* ---------- Instagram ---------- */

export type AdminInstagramPost = {
  id: string;
  url: string;
  kind: "reel" | "post";
  thumbnailPath: string | null;
  videoPath: string | null;
  caption: string | null;
  placement: "hero" | "portfolio" | "reviews";
  active: boolean;
};

export async function listInstagramAdmin(): Promise<AdminInstagramPost[]> {
  return sql<AdminInstagramPost[]>`
    select id, url, kind, thumbnail_path as "thumbnailPath", video_path as "videoPath", caption, placement, active
    from instagram_posts order by sort_order, created_at desc`;
}

export type InstagramInput = { url: string; caption?: string | null; placement: AdminInstagramPost["placement"]; thumbnailPath?: string | null; videoPath?: string | null; active: boolean };

function parseUrl(url: string) {
  const parsed = parseInstagramUrl(url);
  if (!parsed) throw new AdminError(400, "invalid_url", "Paste a link to an Instagram post or reel (instagram.com/p/… or /reel/…).", "url");
  return parsed;
}

export async function createInstagramPost(input: InstagramInput) {
  const parsed = parseUrl(input.url);
  const [row] = await sql<{ id: string }[]>`
    insert into instagram_posts (url, kind, thumbnail_path, video_path, caption, placement, active, sort_order)
    values (${parsed.url}, ${parsed.kind}, ${input.thumbnailPath || null}, ${input.videoPath || null}, ${input.caption || null}, ${input.placement}, ${input.active},
            (select coalesce(min(sort_order), 1) - 1 from instagram_posts))
    returning id`;
  refreshPublic("content");
  return row;
}

export async function updateInstagramPost(id: string, input: InstagramInput) {
  const parsed = parseUrl(input.url);
  const [current] = await sql<{ thumbnail_path: string | null; video_path: string | null }[]>`
    select thumbnail_path, video_path from instagram_posts where id = ${id}`;
  if (!current) throw notFound("Post");
  await sql`
    update instagram_posts set url = ${parsed.url}, kind = ${parsed.kind}, thumbnail_path = ${input.thumbnailPath || null},
      video_path = ${input.videoPath || null}, caption = ${input.caption || null}, placement = ${input.placement}, active = ${input.active}
    where id = ${id}`;
  if (current.thumbnail_path !== (input.thumbnailPath || null)) await deleteUpload(current.thumbnail_path);
  if (current.video_path !== (input.videoPath || null)) await deleteUpload(current.video_path);
  refreshPublic("content");
}

export async function deleteInstagramPost(id: string) {
  const [row] = await sql<{ thumbnail_path: string | null; video_path: string | null }[]>`
    delete from instagram_posts where id = ${id} returning thumbnail_path, video_path`;
  if (!row) throw notFound("Post");
  await deleteUpload(row.thumbnail_path);
  await deleteUpload(row.video_path);
  refreshPublic("content");
}

/* ---------- Testimonials ---------- */

export type AdminTestimonial = { id: string; name: string; quote: string; rating: number; serviceLabel: string | null; visible: boolean };

export async function listTestimonialsAdmin(): Promise<AdminTestimonial[]> {
  return sql<AdminTestimonial[]>`
    select id, name, quote, rating, service_label as "serviceLabel", visible from testimonials order by sort_order, created_at desc`;
}

export type TestimonialInput = Omit<AdminTestimonial, "id">;

export async function createTestimonial(input: TestimonialInput) {
  const [row] = await sql<{ id: string }[]>`
    insert into testimonials (name, quote, rating, service_label, visible, sort_order)
    values (${input.name}, ${input.quote}, ${input.rating}, ${input.serviceLabel || null}, ${input.visible},
            (select coalesce(min(sort_order), 1) - 1 from testimonials))
    returning id`;
  refreshPublic("content");
  return row;
}

export async function updateTestimonial(id: string, input: TestimonialInput) {
  const [row] = await sql`
    update testimonials set name = ${input.name}, quote = ${input.quote}, rating = ${input.rating},
      service_label = ${input.serviceLabel || null}, visible = ${input.visible}
    where id = ${id} returning id`;
  if (!row) throw notFound("Review");
  refreshPublic("content");
}

export async function deleteTestimonial(id: string) {
  const [row] = await sql`delete from testimonials where id = ${id} returning id`;
  if (!row) throw notFound("Review");
  refreshPublic("content");
}
