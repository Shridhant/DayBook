import { z } from "zod";
import { getAdminBooking } from "@/server/admin/bookings";
import { AdminError, adminRoute, notFound, OWNER_ONLY, rupeesSchema } from "@/server/admin/http";
import { refundBooking, RefundError } from "@/server/refunds";
import { sendQueuedEmailsSoon } from "@/server/email";

/**
 * POST /api/admin/bookings/:id/refund  { amount?: rupees, reason? }  (owner only, AGENTS.md §8)
 * Refunds online payments through Razorpay. Without an amount, refunds everything still refundable.
 */

const bodySchema = z.object({
  amount: rupeesSchema.optional(),
  reason: z.string().trim().max(300).optional(),
});

const STATUS: Record<RefundError["code"], number> = {
  not_found: 404,
  nothing_to_refund: 409,
  too_much: 422,
  not_configured: 409,
  rejected: 502,
};

export const POST = adminRoute({ roles: OWNER_ONLY, body: bodySchema }, async ({ body, params, user }) => {
  try {
    const refund = await refundBooking({ bookingId: params.id, amountPaise: body.amount, reason: body.reason, userId: user.id, source: "admin" });
    sendQueuedEmailsSoon();
    const booking = await getAdminBooking(params.id);
    if (!booking) throw notFound("Booking");
    return { booking, refund };
  } catch (error) {
    // A rejected refund was still recorded (as failed), so send the updated booking along.
    if (error instanceof RefundError) {
      const booking = error.code === "rejected" ? await getAdminBooking(params.id) : null;
      throw new AdminError(STATUS[error.code], error.code, error.message, undefined, booking ? { booking } : undefined);
    }
    throw error;
  }
});
