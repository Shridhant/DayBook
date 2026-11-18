/**
 * Demo mode (NEXT_PUBLIC_DEMO_MODE=1): for the sales demo only. Shows a slim "demo" strip on every
 * page and test-payment hints at checkout. Never set it for a real salon. Public by design: it's
 * read in the browser and contains no secret.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

/**
 * Sample bookings from `npm run db:demo` carry made-up Razorpay ids (`pay_demo…`) that Razorpay
 * has never seen. In demo mode their refunds are completed inside the app instead, so the whole
 * refund flow can be shown. Real payments always go to Razorpay.
 */
export function isSamplePayment(rzpPaymentId: string): boolean {
  return DEMO_MODE && rzpPaymentId.startsWith("pay_demo");
}
