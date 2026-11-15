import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { processEmailOutbox } from "@/server/email";

/**
 * GET /api/cron/email — retries queued emails. Run every minute from the VPS crontab:
 *   * * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://yoursalon.in/api/cron/email
 * Disabled (404) until CRON_SECRET is set.
 */
function authorized(request: Request): boolean {
  if (!env.CRON_SECRET) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!env.CRON_SECRET) return new Response("Not found", { status: 404 });
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await processEmailOutbox({ limit: 50 }), { headers: { "Cache-Control": "no-store" } });
}
