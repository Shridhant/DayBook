/**
 * Instagram links (AGENTS.md §9): only post and reel URLs on www.instagram.com are accepted.
 * Same rule as the instagram_posts.url check constraint in the database.
 */

const POST_URL = /^https:\/\/(?:www\.)?instagram\.com\/(p|reel|reels)\/([A-Za-z0-9_-]+)\/?(?:\?.*)?$/;

export type ParsedInstagramUrl = { kind: "post" | "reel"; shortcode: string; url: string };

/**
 * Normalises what people paste from the Instagram app ("instagram.com/reels/ABC?igsh=…") to the
 * canonical form stored in the database ("https://www.instagram.com/reel/ABC/"), or null if invalid.
 */
export function parseInstagramUrl(input: string): ParsedInstagramUrl | null {
  const m = POST_URL.exec(input.trim());
  if (!m) return null;
  const kind = m[1] === "p" ? "post" : "reel";
  const shortcode = m[2];
  return { kind, shortcode, url: `https://www.instagram.com/${kind === "post" ? "p" : "reel"}/${shortcode}/` };
}

/** Embed URL for a stored (canonical) post URL. */
export function instagramEmbedUrl(url: string): string {
  return `${url.replace(/\/?$/, "/")}embed`;
}
