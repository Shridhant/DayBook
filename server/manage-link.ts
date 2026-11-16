import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Private "manage my booking" links for customers, who never log in (AGENTS.md §1). The key is an
 * HMAC of the booking id, so nothing is stored and any email (confirmation now, reminders later)
 * can rebuild the same link. Without the server secret a key can't be guessed from the code.
 */

// Production requires BETTER_AUTH_SECRET (lib/env.ts); the fallback only keeps local dev working.
const SECRET = env.BETTER_AUTH_SECRET ?? "daybook-local-dev-only-manage-links";
const KEY_LENGTH = 32;

export const MANAGE_KEY_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function manageKey(bookingId: string): string {
  return createHmac("sha256", SECRET).update(`manage-booking:${bookingId}`).digest("base64url").slice(0, KEY_LENGTH);
}

export function isValidManageKey(bookingId: string, key: string): boolean {
  if (!MANAGE_KEY_PATTERN.test(key)) return false;
  return timingSafeEqual(Buffer.from(manageKey(bookingId)), Buffer.from(key));
}

/** Path for the customer's manage page, e.g. /booking/DB-7KQ2MX?k=… */
export function managePath(code: string, bookingId: string): string {
  return `/booking/${code}?k=${manageKey(bookingId)}`;
}

export function manageUrl(code: string, bookingId: string): string {
  return new URL(managePath(code, bookingId), env.SITE_URL).toString();
}
