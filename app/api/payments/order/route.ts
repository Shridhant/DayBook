import { z } from "zod";
import { RazorpayApiError, RazorpayNotConfiguredError } from "@/lib/razorpay";
import { sendQueuedEmailsSoon } from "@/server/email";
import { PaymentError, startPayment } from "@/server/payments";

/**
 * POST /api/payments/order  { bookingId }
 * Creates (or reuses) the Razorpay order for a held booking and returns what Checkout needs.
 * The amount is the booking's snapshotted amount_due_now_paise; nothing from the client is trusted.
 */

const bodySchema = z.object({ bookingId: z.uuid() });
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", message: "Invalid booking" }, { status: 400, headers: noStore });
  }
  try {
    const start = await startPayment(parsed.data.bookingId);
    if (start.kind === "confirmed") sendQueuedEmailsSoon(); // ₹0 bookings confirm here
    return Response.json(start, { headers: noStore });
  } catch (error) {
    if (error instanceof PaymentError) {
      const status = error.code === "not_found" ? 404 : 409;
      return Response.json({ error: error.code, message: error.message }, { status, headers: noStore });
    }
    // Only bookings that need an online payment reach Razorpay; ₹0 bookings confirm without it.
    if (error instanceof RazorpayNotConfiguredError) {
      return Response.json(
        { error: "payments_unavailable", message: "Online payments aren't available right now." },
        { status: 503, headers: noStore },
      );
    }
    if (error instanceof RazorpayApiError) {
      return Response.json(
        { error: "payment_provider_error", message: "Couldn't start the payment. Please try again." },
        { status: 502, headers: noStore },
      );
    }
    throw error;
  }
}
