/** refunds.status. */
export type RefundStatus = "creating" | "pending" | "processed" | "failed";

/**
 * Lifecycle of a refund (AGENTS.md §7 Refunds). `creating` is ours: the row and the reserved amount
 * exist before Razorpay is called. Razorpay's API answer and refund webhooks then move it forward
 * only, in whatever order they arrive:
 *
 *   creating ──► pending ──► processed
 *       └───────────┴──────► failed       (the reserved amount is released)
 *
 * processed and failed are final: a processed refund can't fail afterwards. Pure.
 */
const RANK: Record<RefundStatus, number> = { creating: 0, pending: 1, processed: 2, failed: 3 };

export function isFinalRefundStatus(status: RefundStatus): boolean {
  return status === "processed" || status === "failed";
}

/** The status to store after Razorpay reports `incoming`, or null if it would move backwards. */
export function nextRefundStatus(current: RefundStatus, incoming: Exclude<RefundStatus, "creating">): RefundStatus | null {
  if (isFinalRefundStatus(current) || RANK[incoming] <= RANK[current]) return null;
  return incoming;
}
