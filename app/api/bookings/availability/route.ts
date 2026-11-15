import { z } from "zod";
import { formatTime, isDateKey } from "@/lib/time";
import { AvailabilityError, getAvailability } from "@/server/availability-query";
import { clientIp, hitRateLimit, LIMITS, tooManyRequests } from "@/server/rate-limit";

/**
 * GET /api/bookings/availability?date=2026-11-20&services=<uuid>,<uuid>[&staff=<uuid>]
 *
 * Public, so it returns start times only, never which technicians are free.
 * Always fresh (reads the request and the database, so Next renders it per request).
 */

const uuid = z.uuid();

const querySchema = z.object({
  date: z.string().refine(isDateKey, "Invalid date"),
  services: z
    .string()
    .transform((v) => [...new Set(v.split(",").map((s) => s.trim()).filter(Boolean))])
    .pipe(z.array(uuid).min(1, "Choose at least one service").max(10)),
  staff: uuid.optional(),
});

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const limited = await hitRateLimit(`availability:ip:${clientIp(request)}`, LIMITS.availabilityPerIp);
  if (!limited.allowed) return tooManyRequests(limited);

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_request", message: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400, headers: noStore },
    );
  }

  try {
    const result = await getAvailability({
      date: parsed.data.date,
      serviceIds: parsed.data.services,
      staffId: parsed.data.staff,
    });

    return Response.json(
      {
        date: result.date,
        durationMin: result.durationMin,
        closedReason: result.closedReason,
        slots: result.slots.map((s) => ({
          minutes: s.minutes,
          label: formatTime(s.minutes),
          startsAt: s.startsAt.toISOString(),
        })),
      },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof AvailabilityError) {
      return Response.json({ error: error.code, message: error.message }, { status: 422, headers: noStore });
    }
    throw error;
  }
}
