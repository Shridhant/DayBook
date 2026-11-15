import { z } from "zod";
import { requireApiUser } from "@/server/admin/auth";
import { AdminBookingError, applyBookingAction } from "@/server/admin/bookings";

/** PATCH /api/admin/bookings/:id  { action: complete | no_show | cancel | reopen, reason? } */

const bodySchema = z.object({
  action: z.enum(["complete", "no_show", "cancel", "reopen"]),
  reason: z.string().trim().max(300).optional(),
});

const statusFor: Record<AdminBookingError["code"], number> = {
  not_found: 404,
  not_allowed: 422,
  conflict: 409,
  slot_unavailable: 409,
  slot_taken: 409,
};

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/bookings/[id]">) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) {
    return Response.json({ error: "invalid_request", message: "Invalid request." }, { status: 400 });
  }

  try {
    const booking = await applyBookingAction({ bookingId: id, ...parsed.data });
    return Response.json({ booking });
  } catch (error) {
    if (error instanceof AdminBookingError) {
      return Response.json({ error: error.code, message: error.message }, { status: statusFor[error.code] });
    }
    throw error;
  }
}
