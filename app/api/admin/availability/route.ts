import { z } from "zod";
import { formatTime, isDateKey } from "@/lib/time";
import { requireApiUser } from "@/server/admin/auth";
import { AvailabilityError, getAvailability } from "@/server/availability-query";

/** GET /api/admin/availability?date&services[&staff] — like the public one, without the online lead time. */

const querySchema = z.object({
  date: z.string().refine(isDateKey, "Invalid date"),
  services: z
    .string()
    .transform((v) => [...new Set(v.split(",").map((s) => s.trim()).filter(Boolean))])
    .pipe(z.array(z.uuid()).min(1).max(10)),
  staff: z.uuid().optional(),
});

export async function GET(request: Request) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "invalid_request", message: "Invalid request" }, { status: 400 });

  try {
    const result = await getAvailability({
      date: parsed.data.date,
      serviceIds: parsed.data.services,
      staffId: parsed.data.staff,
      forAdmin: true,
    });
    return Response.json({
      date: result.date,
      durationMin: result.durationMin,
      closedReason: result.closedReason,
      slots: result.slots.map((s) => ({ minutes: s.minutes, label: formatTime(s.minutes), freeStaff: s.staffIds.length })),
    });
  } catch (error) {
    if (error instanceof AvailabilityError) return Response.json({ error: error.code, message: error.message }, { status: 422 });
    throw error;
  }
}
