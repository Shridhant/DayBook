import { z } from "zod";
import { indianMobileSchema } from "@/lib/phone";
import { isDateKey } from "@/lib/time";
import { requireApiUser } from "@/server/admin/auth";
import { AdminBookingError, createAdminBooking } from "@/server/admin/bookings";
import { AvailabilityError } from "@/server/availability-query";

/** POST /api/admin/bookings — walk-in or phone booking, confirmed immediately, paid at the studio. */

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
    name: z.string().trim().min(2, "Enter the customer's name").max(60),
    phone: indianMobileSchema,
  }),
  source: z.enum(["walk_in", "phone"]),
  notes: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json(
      { error: "invalid_request", message: issue?.message ?? "Invalid request", field: issue?.path.join(".") },
      { status: 400 },
    );
  }

  try {
    const { staffId, ...rest } = parsed.data;
    const booking = await createAdminBooking({ ...rest, staffId: staffId ?? undefined, createdByUserId: user.id });
    return Response.json({ booking }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminBookingError) return Response.json({ error: error.code, message: error.message }, { status: 409 });
    if (error instanceof AvailabilityError) return Response.json({ error: error.code, message: error.message }, { status: 422 });
    throw error;
  }
}
