import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { processEmailOutbox } from "@/server/email";
import { pruneRateLimits } from "@/server/rate-limit";
import { queueDueReminders } from "@/server/reminders";

/**
 * GET /api/cron/email — queues due appointment reminders, sends/retries queued emails and prunes
 * old rate-limit rows. Run every minute:
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
  const reminders = await queueDueReminders();
  const result = await processEmailOutbox({ limit: 50 });
  await pruneRateLimits();
  return Response.json({ ...result, reminders }, { headers: { "Cache-Control": "no-store" } });
}
