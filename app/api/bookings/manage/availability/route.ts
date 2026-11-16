import { z } from "zod";
import { formatTime } from "@/lib/time";
import { rescheduleOptions } from "@/server/manage-booking";
import { dateKeySchema, invalidRequest, manageAuthSchema, manageErrorResponse, noStore } from "@/server/manage-http";
import { clientIp, hitRateLimit, LIMITS, tooManyRequests } from "@/server/rate-limit";

/** GET /api/bookings/manage/availability?code&key&date&any=1 — times a customer can move their booking to. */

const querySchema = manageAuthSchema.extend({ date: dateKeySchema, any: z.enum(["0", "1"]).default("0") });

export async function GET(request: Request) {
  const limited = await hitRateLimit(`availability:ip:${clientIp(request)}`, LIMITS.availabilityPerIp);
  if (!limited.allowed) return tooManyRequests(limited);

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return invalidRequest(parsed.error.issues[0]?.message);
  const { code, key, date, any } = parsed.data;

  try {
    const result = await rescheduleOptions(code, key, date, any === "1");
    return Response.json(
      {
        date: result.date,
        durationMin: result.durationMin,
        closedReason: result.closedReason,
        slots: result.slots.map((s) => ({ minutes: s.minutes, label: formatTime(s.minutes), startsAt: s.startsAt.toISOString() })),
      },
      { headers: noStore },
    );
  } catch (error) {
    return manageErrorResponse(error);
  }
}
