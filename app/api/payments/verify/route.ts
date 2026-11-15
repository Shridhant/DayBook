import { z } from "zod";
import { isRazorpayConfigured, RazorpayApiError, verifyCheckoutSignature } from "@/lib/razorpay";
import { sendQueuedEmailsSoon } from "@/server/email";
import { settlePayment } from "@/server/payments";

/**
 * POST /api/payments/verify — called by the Checkout success handler.
 * The signature proves the ids came from Razorpay; the payment's real state is then fetched from
 * the Razorpay API before anything is confirmed. The webhook does the same independently.
 */

const bodySchema = z.object({
  razorpay_order_id: z.string().startsWith("order_"),
  razorpay_payment_id: z.string().startsWith("pay_"),
  razorpay_signature: z.string().min(1),
});

const noStore = { "Cache-Control": "no-store" };

const messages = {
  confirmed: "Your booking is confirmed.",
  already_confirmed: "Your booking is confirmed.",
  processing: "Payment received. We're confirming your booking; this can take a minute.",
  failed: "The payment didn't go through. No money was taken.",
  needs_review:
    "Your payment was received, but we couldn't confirm the slot automatically. The studio will contact you, and you'll be refunded if needed.",
  unknown_order: "We couldn't find this payment.",
} as const;

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers: noStore });
  }
  if (!isRazorpayConfigured()) {
    return Response.json({ error: "payments_unavailable" }, { status: 503, headers: noStore });
  }

  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;
  if (!verifyCheckoutSignature({ orderId, paymentId, signature })) {
    return Response.json({ error: "invalid_signature" }, { status: 400, headers: noStore });
  }

  try {
    const result = await settlePayment(paymentId, { expectedOrderId: orderId });
    sendQueuedEmailsSoon();
    if (result.orderId !== orderId) {
      return Response.json({ error: "invalid_request" }, { status: 400, headers: noStore });
    }
    return Response.json(
      { status: result.outcome, code: result.code, message: messages[result.outcome] },
      { status: result.outcome === "unknown_order" ? 404 : 200, headers: noStore },
    );
  } catch (error) {
    if (error instanceof RazorpayApiError) {
      // The webhook will still settle it; tell the customer it's in progress, not that it failed.
      return Response.json({ status: "processing", code: null, message: messages.processing }, { status: 202, headers: noStore });
    }
    throw error;
  }
}
