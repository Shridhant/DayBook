import { handleRazorpayWebhook } from "@/server/razorpay-webhook";

/**
 * POST /api/webhooks/razorpay
 * Configure in Razorpay → Webhooks with events: payment.authorized, payment.captured,
 * payment.failed, order.paid. Non-2xx responses make Razorpay retry, which is what we want on errors.
 */
export async function POST(request: Request) {
  // The signature covers the exact bytes, so read the raw body before any JSON parsing.
  const rawBody = await request.text();
  const result = await handleRazorpayWebhook(
    rawBody,
    request.headers.get("x-razorpay-signature"),
    request.headers.get("x-razorpay-event-id"),
  );

  switch (result.status) {
    case "processed":
    case "duplicate":
      return Response.json({ ok: true });
    case "invalid_signature":
      return Response.json({ error: "invalid_signature" }, { status: 401 });
    case "invalid_payload":
      return Response.json({ error: "invalid_payload" }, { status: 400 });
    case "not_configured":
      return Response.json({ error: "not_configured" }, { status: 503 });
  }
}
