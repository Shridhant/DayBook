import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { sql } from "@/lib/db";

/**
 * Landing-page content managed by the owner (portfolio, Instagram, testimonials).
 * Cached; the admin invalidates CONTENT_TAG after edits (AGENTS.md §5).
 */

export const CONTENT_TAG = "content";

export type PortfolioItem = {
  id: string;
  imagePath: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  categoryId: string | null;
  featured: boolean;
};

export type InstagramPost = {
  id: string;
  url: string;
  kind: "reel" | "post";
  thumbnailPath: string | null;
  /** Salon-uploaded clip: the card's preview, played on desktop hover. */
  videoPath: string | null;
  caption: string | null;
  placement: "hero" | "portfolio" | "reviews";
};

export type Testimonial = {
  id: string;
  name: string;
  quote: string;
  rating: number;
  serviceLabel: string | null;
};

export async function getPortfolio(): Promise<PortfolioItem[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG);
  const rows = await sql<
    { id: string; image_path: string; width: number; height: number; alt: string; caption: string | null; category_id: string | null; featured: boolean }[]
  >`select id, image_path, width, height, alt, caption, category_id, featured
    from portfolio_items where active order by featured desc, sort_order, created_at desc`;
  return rows.map((r) => ({
    id: r.id,
    imagePath: r.image_path,
    width: r.width,
    height: r.height,
    alt: r.alt,
    caption: r.caption,
    categoryId: r.category_id,
    featured: r.featured,
  }));
}

export async function getInstagramPosts(): Promise<InstagramPost[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG);
  const rows = await sql<
    { id: string; url: string; kind: "reel" | "post"; thumbnail_path: string | null; video_path: string | null; caption: string | null; placement: InstagramPost["placement"] }[]
  >`select id, url, kind, thumbnail_path, video_path, caption, placement from instagram_posts where active order by sort_order, created_at desc`;
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    kind: r.kind,
    thumbnailPath: r.thumbnail_path,
    videoPath: r.video_path,
    caption: r.caption,
    placement: r.placement,
  }));
}

export async function getTestimonials(): Promise<Testimonial[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG);
  const rows = await sql<{ id: string; name: string; quote: string; rating: number; service_label: string | null }[]>`
    select id, name, quote, rating, service_label from testimonials where visible order by sort_order, created_at desc`;
  return rows.map((r) => ({ id: r.id, name: r.name, quote: r.quote, rating: r.rating, serviceLabel: r.service_label }));
}
