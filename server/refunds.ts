import "server-only";
import type { TransactionSql } from "postgres";
import { z } from "zod";
import { sql } from "@/lib/db";
import { isSamplePayment } from "@/lib/demo";
import { log } from "@/lib/log";
import { formatINR } from "@/lib/money";
import { createRefund, isRazorpayConfigured, RazorpayApiError, refundNoteId, type RazorpayRefund } from "@/lib/razorpay";
import { nextRefundStatus, type RefundStatus } from "@/lib/refund-status";
import { onRefundFailed, onRefundStarted } from "./notifications";

/**
 * Refunds of online payments (phase 2; AGENTS.md §7). Two steps, so money is never refunded twice
 * and never lost track of:
 *   1. In a transaction (payment rows locked), check what's refundable and save `creating` refund
 *      rows, reserving the amount in payments.refunded_paise.
 *   2. Call Razorpay for each row, outside the transaction, and record its answer.
 * Razorpay's refund webhooks feed the same `applyRefundState`, so a call that timed out after
 * Razorpay accepted it is completed by the webhook, and refunds made in the Razorpay dashboard are
 * recorded too.
 */

export type { RefundStatus };

export class RefundError extends Error {
  constructor(
    public readonly code: "not_found" | "nothing_to_refund" | "too_much" | "not_configured" | "rejected",
    message: string,
  ) {
    super(message);
  }
}

export type RefundOutcome = {
  amountPaise: number;
  /** pending/processed: Razorpay accepted it. creating: no answer yet (the webhook will settle it). */
  status: Exclude<RefundStatus, "failed">;
};

/** Refunds `amountPaise` (default: everything still refundable) of a booking's online payments. */
export async function refundBooking(params: {
  bookingId: string;
  amountPaise?: number;
  reason?: string | null;
  userId: string | null;
  source: "admin" | "auto";
}): Promise<RefundOutcome> {
  if (!isRazorpayConfigured()) throw new RefundError("not_configured", "Online payments aren't set up, so there's nothing to refund here.");

  const created = await sql.begin(async (tx) => {
    const [booking] = await tx<{ code: string }[]>`select code from bookings where id = ${params.bookingId}`;
    if (!booking) throw new RefundError("not_found", "Booking not found.");

    const payments = await tx<{ id: string; rzp_payment_id: string; refundable: number }[]>`
      select id, rzp_payment_id, amount_paise - refunded_paise as refundable from payments
      where booking_id = ${params.bookingId} and status = 'captured' and rzp_payment_id is not null
      order by amount_paise - refunded_paise desc
      for update`;
    const refundable = payments.reduce((sum, p) => sum + p.refundable, 0);
    if (refundable <= 0) throw new RefundError("nothing_to_refund", "Nothing paid online is left to refund on this booking.");

    const amount = params.amountPaise ?? refundable;
    if (!Number.isInteger(amount) || amount <= 0) throw new RefundError("too_much", "Enter an amount to refund.");
    if (amount > refundable) throw new RefundError("too_much", `You can refund at most ${formatINR(refundable)}.`);

    // Usually one payment per booking; split across several if needed, largest first.
    const rows: { id: string; paymentId: string; rzpPaymentId: string; amount: number }[] = [];
    let left = amount;
    for (const p of payments) {
      if (left === 0) break;
      const part = Math.min(left, p.refundable);
      if (part <= 0) continue;
      left -= part;
      const [refund] = await tx<{ id: string }[]>`
        insert into refunds (payment_id, booking_id, amount_paise, reason, created_by, source)
        values (${p.id}, ${params.bookingId}, ${part}, ${params.reason?.trim() || null}, ${params.userId}, ${params.source})
        returning id`;
      // Fully refunded money no longer needs the owner's review.
      await tx`
        update payments set refunded_paise = refunded_paise + ${part},
                            needs_review = needs_review and refunded_paise + ${part} < amount_paise
        where id = ${p.id}`;
      rows.push({ id: refund.id, paymentId: p.id, rzpPaymentId: p.rzp_payment_id, amount: part });
    }
    return { code: booking.code, rows };
  });

  let settled = true;
  const failures: string[] = [];
  for (const row of created.rows) {
    if (isSamplePayment(row.rzpPaymentId)) {
      await applyRefundState(sampleRefund(row.rzpPaymentId, row.amount, row.id), row.id);
      continue;
    }
    try {
      const refund = await createRefund({
        paymentId: row.rzpPaymentId,
        amountPaise: row.amount,
        refundId: row.id,
        notes: { booking_id: params.bookingId, booking_code: created.code },
      });
      await applyRefundState(refund, row.id);
    } catch (error) {
      if (error instanceof RazorpayApiError && error.status >= 400 && error.status < 500) {
        // A definite "no" (e.g. not enough balance): release the amount so it can be retried.
        await failRefund(row.id, error.description);
        failures.push(error.description);
      } else {
        // Timeout or Razorpay error: it may or may not have gone through. Leave it `creating`;
        // the refund webhook settles it either way.
        settled = false;
        log.error("refunds", `no answer from Razorpay for refund ${row.id}`, error);
      }
    }
  }

  if (failures.length) throw new RefundError("rejected", `Razorpay didn't accept the refund: ${failures[0]}`);
  return { amountPaise: created.rows.reduce((s, r) => s + r.amount, 0), status: settled ? "pending" : "creating" };
}

/** What Razorpay would answer for a demo sample payment: refunded straight away. */
function sampleRefund(paymentId: string, amount: number, refundId: string): RazorpayRefund {
  return { id: `rfnd_demo${refundId.replaceAll("-", "").slice(-14)}`, payment_id: paymentId, amount, currency: "INR", status: "processed", notes: { refund_id: refundId } };
}

/* ---------- Recording Razorpay's answer (API response or webhook) ---------- */

async function releaseAmount(tx: TransactionSql, refundId: string) {
  // The money stays with the salon: give it back to "refundable" and flag the payment for review.
  await tx`
    update payments p set refunded_paise = greatest(0, p.refunded_paise - r.amount_paise), needs_review = true
    from refunds r where r.id = ${refundId} and p.id = r.payment_id`;
}

async function failRefund(refundId: string, reason: string) {
  await sql.begin(async (tx) => {
    const [row] = await tx`
      update refunds set status = 'failed', failure_reason = ${reason}
      where id = ${refundId} and status <> 'failed' returning id`;
    if (!row) return;
    await releaseAmount(tx, refundId);
    await onRefundFailed(tx, refundId, reason);
  });
}

/**
 * Records a refund's state from Razorpay. Idempotent and only moves forward
 * (creating → pending → processed, or → failed), so webhook retries and the API response can
 * arrive in any order. `ourId` is the refund row we created, when known.
 */
export async function applyRefundState(refund: RazorpayRefund, ourId?: string | null): Promise<void> {
  const noteId = ourId ?? refundNoteId(refund);
  const knownId = noteId && z.uuid().safeParse(noteId).success ? noteId : null;

  await sql.begin(async (tx) => {
    const [row] = await tx<{ id: string; status: RefundStatus }[]>`
      select id, status from refunds
      where rzp_refund_id = ${refund.id} ${knownId ? tx`or id = ${knownId}` : tx``}
      for update`;

    if (!row) {
      await recordDashboardRefund(tx, refund);
      return;
    }
    if (!nextRefundStatus(row.status, refund.status)) return;

    await tx`update refunds set status = ${refund.status}, rzp_refund_id = ${refund.id}, raw = ${tx.json(refund)} where id = ${row.id}`;
    if (refund.status === "failed") {
      await releaseAmount(tx, row.id);
      await onRefundFailed(tx, row.id, "Razorpay couldn't complete it. The money is still in your account.");
    } else if (row.status === "creating") {
      await onRefundStarted(tx, row.id);
    }
  });
}

/** A refund made outside the app (Razorpay dashboard): record it so the booking shows the right amounts. */
async function recordDashboardRefund(tx: TransactionSql, refund: RazorpayRefund) {
  const [payment] = await tx<{ id: string; booking_id: string; refundable: number }[]>`
    select id, booking_id, amount_paise - refunded_paise as refundable from payments
    where rzp_payment_id = ${refund.payment_id} for update`;
  if (!payment) return; // not one of ours
  const counts = refund.status !== "failed";
  const [inserted] = await tx<{ id: string }[]>`
    insert into refunds (payment_id, booking_id, amount_paise, status, rzp_refund_id, source, reason, raw)
    values (${payment.id}, ${payment.booking_id}, ${refund.amount}, ${refund.status}, ${refund.id}, 'dashboard',
            'Refunded in the Razorpay dashboard', ${tx.json(refund)})
    on conflict (rzp_refund_id) do nothing
    returning id`;
  if (!inserted || !counts) return;
  const part = Math.min(refund.amount, payment.refundable);
  await tx`
    update payments set refunded_paise = refunded_paise + ${part},
                        needs_review = needs_review and refunded_paise + ${part} < amount_paise
    where id = ${payment.id}`;
  await onRefundStarted(tx, inserted.id);
}
