import "server-only";
import { sql } from "@/lib/db";

/**
 * Fixed-window rate limiting for public endpoints (AGENTS.md §9 spam protection), stored in
 * Postgres so limits survive restarts. The increment and the check are one atomic statement, so
 * concurrent requests can't both slip under the limit.
 */

export type RateLimitRule = { limit: number; windowSeconds: number };

export const LIMITS = {
  /** Holding a slot: generous for a real customer changing their mind, tight for bots. */
  holdPerIp: { limit: 10, windowSeconds: 600 },
  holdPerPhone: { limit: 6, windowSeconds: 3600 },
  paymentPerIp: { limit: 20, windowSeconds: 600 },
  availabilityPerIp: { limit: 120, windowSeconds: 60 },
  /** Manage-booking actions (cancel, move). Viewing times uses availabilityPerIp. */
  managePerIp: { limit: 20, windowSeconds: 600 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export async function hitRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const [row] = await sql<{ count: number; retry_after: number }[]>`
    insert into request_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when request_limits.window_start <= now() - make_interval(secs => ${rule.windowSeconds})
                   then 1 else request_limits.count + 1 end,
      window_start = case when request_limits.window_start <= now() - make_interval(secs => ${rule.windowSeconds})
                          then now() else request_limits.window_start end
    returning count,
      greatest(1, ceil(extract(epoch from (window_start + make_interval(secs => ${rule.windowSeconds}) - now()))))::int as retry_after`;
  return {
    allowed: row.count <= rule.limit,
    remaining: Math.max(0, rule.limit - row.count),
    retryAfterSeconds: row.retry_after,
  };
}

/** Removes windows that ended long ago. Called from the cron endpoint. */
export async function pruneRateLimits(): Promise<void> {
  await sql`delete from request_limits where window_start < now() - interval '1 day'`;
}

/**
 * Client IP. In production the app sits behind Caddy (and optionally Cloudflare), which set these
 * headers; it must never be exposed directly, or clients could spoof them. Locally there's no
 * proxy, so everything shares the "unknown" bucket.
 */
export function clientIp(request: Request): string {
  const h = request.headers;
  const ip =
    h.get("cf-connecting-ip")?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return ip.slice(0, 64);
}

/** A 429 response with a friendly message and Retry-After. */
export function tooManyRequests(result: RateLimitResult, message = "Too many attempts. Please wait a few minutes and try again.") {
  return Response.json(
    { error: "rate_limited", message },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds), "Cache-Control": "no-store" } },
  );
}
