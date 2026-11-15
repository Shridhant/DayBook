import { z } from "zod";
import { indianMobileSchema } from "@/lib/phone";
import { isDateKey } from "@/lib/time";
import { AvailabilityError } from "@/server/availability-query";
import { createHold, HoldError } from "@/server/holds";
import { clientIp, hitRateLimit, LIMITS, tooManyRequests } from "@/server/rate-limit";

/**
 * POST /api/bookings/hold
 * Reserves a slot for a few minutes as a `pending` booking while the customer pays.
 * The amount comes from the database; any price sent by the client is ignored.
 */

const bodySchema = z.object({
  serviceIds: z
    .array(z.uuid())
    .min(1, "Choose at least one service")
    .max(10)
    .refine((ids) => new Set(ids).size === ids.length, "Each service can only be chosen once"),
  staffId: z.uuid().nullish(),
  date: z.string().refine(isDateKey, "Invalid date"),
  startMinutes: z.number().int().min(0).max(1439),
  customer: z.object({
    name: z.string().trim().min(2, "Please enter your name").max(60),
    phone: indianMobileSchema,
    email: z
      .union([z.literal(""), z.email("Enter a valid email").max(254)])
      .optional()
      .transform((v) => (v ? v.toLowerCase() : undefined)),
  }),
  notes: z.string().trim().max(500).optional(),
});

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  // Each hold blocks a slot for a few minutes, so this is the endpoint bots would abuse.
  const byIp = await hitRateLimit(`hold:ip:${clientIp(request)}`, LIMITS.holdPerIp);
  if (!byIp.allowed) return tooManyRequests(byIp);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "invalid_request", message: "Invalid JSON body" }, { status: 400, headers: noStore });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json(
      { error: "invalid_request", message: issue?.message ?? "Invalid request", field: issue?.path.join(".") },
      { status: 400, headers: noStore },
    );
  }

  // Keyed by the normalised number, so reformatting it doesn't get around the limit.
  const byPhone = await hitRateLimit(`hold:phone:${parsed.data.customer.phone}`, LIMITS.holdPerPhone);
  if (!byPhone.allowed) return tooManyRequests(byPhone, "Too many booking attempts for this number. Please try again later or call the studio.");

  const { staffId, notes, ...rest } = parsed.data;
  try {
    const hold = await createHold({ ...rest, staffId: staffId ?? undefined, notes: notes || undefined });
    return Response.json(
      {
        bookingId: hold.bookingId,
        code: hold.code,
        staff: hold.staff,
        startsAt: hold.startsAt.toISOString(),
        endsAt: hold.endsAt.toISOString(),
        holdExpiresAt: hold.holdExpiresAt.toISOString(),
        totalPaise: hold.totalPaise,
        amountDueNowPaise: hold.amountDueNowPaise,
        items: hold.items,
      },
      { status: 201, headers: noStore },
    );
  } catch (error) {
    if (error instanceof HoldError) {
      return Response.json({ error: error.code, message: error.message }, { status: 409, headers: noStore });
    }
    if (error instanceof AvailabilityError) {
      return Response.json({ error: error.code, message: error.message }, { status: 422, headers: noStore });
    }
    throw error;
  }
}
