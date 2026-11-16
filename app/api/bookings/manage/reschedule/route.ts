import { z } from "zod";
import { sendQueuedEmailsSoon } from "@/server/email";
import { rescheduleByCustomer } from "@/server/manage-booking";
import { dateKeySchema, invalidRequest, manageAuthSchema, manageErrorResponse, noStore } from "@/server/manage-http";
import { clientIp, hitRateLimit, LIMITS, tooManyRequests } from "@/server/rate-limit";

/** POST /api/bookings/manage/reschedule { code, key, date, startMinutes, anyArtist } — the customer moves their booking. */

const bodySchema = manageAuthSchema.extend({
  date: dateKeySchema,
  startMinutes: z.number().int().min(0).max(1439),
  anyArtist: z.boolean().default(false),
});

export async function POST(request: Request) {
  const limited = await hitRateLimit(`manage:ip:${clientIp(request)}`, LIMITS.managePerIp);
  if (!limited.allowed) return tooManyRequests(limited);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidRequest(parsed.error.issues[0]?.message);
  const { code, key, ...target } = parsed.data;

  try {
    const booking = await rescheduleByCustomer(code, key, target);
    sendQueuedEmailsSoon();
    return Response.json({ booking }, { headers: noStore });
  } catch (error) {
    return manageErrorResponse(error);
  }
}
