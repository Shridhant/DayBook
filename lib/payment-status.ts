/** payments.status, one row per Razorpay order. */
export type PaymentStatus = "created" | "authorized" | "captured" | "failed" | "refunded" | "partially_refunded";

/** A payment's status as Razorpay reports it (API response or webhook). */
export type RazorpayPaymentStatus = "created" | "authorized" | "captured" | "refunded" | "failed";

/**
 * Lifecycle of a payments row (AGENTS.md §7). Razorpay events arrive in any order and more than
 * once (verify, payment.captured and order.paid all report the same capture), so a status only
 * moves forward:
 *
 *   created ──fail──► failed ──retry──► authorized ──► captured
 *      └──────────────────────────────────┴───────────► captured
 *
 * Settled payments (captured, and the legacy refunded states) never change here: refunds are
 * tracked in `refunds` and payments.refunded_paise. Pure, so it's tested without a database.
 */
const ALLOWED_FROM: Record<RazorpayPaymentStatus, readonly PaymentStatus[]> = {
  created: [],
  failed: ["created", "failed"],
  authorized: ["created", "failed", "authorized"],
  captured: ["created", "failed", "authorized"],
  refunded: [],
};

/** The status to store after Razorpay reports `incoming`, or null to leave the row as it is. */
export function nextPaymentStatus(current: PaymentStatus, incoming: RazorpayPaymentStatus): PaymentStatus | null {
  return ALLOWED_FROM[incoming].includes(current) ? incoming : null;
}

/** Money was taken on this order. Later events for it are repeats or a second payment. */
export function isSettled(status: PaymentStatus): boolean {
  return status === "captured" || status === "refunded" || status === "partially_refunded";
}
