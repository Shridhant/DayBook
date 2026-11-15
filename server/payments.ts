import "server-only";
import postgres from "postgres";
import { sql } from "@/lib/db";
import { toE164 } from "@/lib/phone";
import {
  capturePayment,
  createOrder,
  fetchPayment,
  publicKeyId,
  RazorpayApiError,
  type RazorpayPayment,
} from "@/lib/razorpay";

/**
 * Payments (AGENTS.md §7 "Payments"). Two entry points confirm bookings:
 *   - /api/payments/verify, after Checkout succeeds (fast path for the confirmation screen), and
 *   - /api/webhooks/razorpay (source of truth; also covers closed tabs and dropped connections).
 * Both end in `recordPayment`, which is idempotent and only trusts payment data that came from
 * Razorpay (the signed webhook or a server-to-server API fetch), never from the browser.
 */

export class PaymentError extends Error {
  constructor(
    public readonly code: "not_found" | "hold_expired",
    message: string,
  ) {
    super(message);
  }
}

/* ---------- Start payment: create (or reuse) a Razorpay order for a held booking ---------- */

export type PaymentStart =
  | { kind: "order"; code: string; orderId: string; amountPaise: number; keyId: string;
      prefill: { name: string; contact: string | null; email: string | null } }
  | { kind: "confirmed"; code: string };

export async function startPayment(bookingId: string): Promise<PaymentStart> {
  const [booking] = await sql<
    { id: string; code: string; status: string; live: boolean; amount_due_now_paise: number;
      name: string; phone: string; email: string | null }[]
  >`
    select b.id, b.code, b.status, (b.hold_expires_at > now()) as live, b.amount_due_now_paise,
           c.name, c.phone, c.email
    from bookings b join customers c on c.id = b.customer_id
    where b.id = ${bookingId} and b.source = 'online'`;

  if (!booking) throw new PaymentError("not_found", "Booking not found.");
  if (booking.status === "confirmed") return { kind: "confirmed", code: booking.code };
  if (booking.status !== "pending" || !booking.live) {
    throw new PaymentError("hold_expired", "Your slot hold has expired. Please pick a time again.");
  }

  // Owner set a ₹0 booking amount: nothing to pay online, confirm straight away.
  if (booking.amount_due_now_paise === 0) {
    const [row] = await sql`
      update bookings set status = 'confirmed', hold_expires_at = null
      where id = ${booking.id} and status = 'pending' and hold_expires_at > now()
      returning id`;
    if (!row) throw new PaymentError("hold_expired", "Your slot hold has expired. Please pick a time again.");
    return { kind: "confirmed", code: booking.code };
  }

  // Reuse an open order so retries (and double clicks) don't create duplicates.
  const [existing] = await sql<{ rzp_order_id: string }[]>`
    select rzp_order_id from payments
    where booking_id = ${booking.id} and status in ('created', 'failed') and amount_paise = ${booking.amount_due_now_paise}
    order by created_at desc limit 1`;

  let orderId = existing?.rzp_order_id;
  if (!orderId) {
    const order = await createOrder({
      amountPaise: booking.amount_due_now_paise,
      receipt: booking.code,
      notes: { booking_id: booking.id, booking_code: booking.code },
    });
    await sql`
      insert into payments (booking_id, rzp_order_id, amount_paise, status)
      values (${booking.id}, ${order.id}, ${order.amount}, 'created')
      on conflict (rzp_order_id) do nothing`;
    orderId = order.id;
  }

  return {
    kind: "order",
    code: booking.code,
    orderId,
    amountPaise: booking.amount_due_now_paise,
    keyId: publicKeyId(),
    prefill: { name: booking.name, contact: toE164(booking.phone), email: booking.email },
  };
}

/* ---------- Record a payment and confirm the booking ---------- */

export type PaymentOutcome =
  | "confirmed" // booking confirmed now
  | "already_confirmed" // idempotent repeat
  | "processing" // authorized but not captured yet; a later event will finish it
  | "failed" // this attempt failed; no money taken
  | "needs_review" // money taken but the booking couldn't be confirmed: owner must act
  | "unknown_order"; // not one of ours

const BLOCKED_BY_OTHER_BOOKING = "23P01";

export async function recordPayment(payment: RazorpayPayment): Promise<{ outcome: PaymentOutcome; code: string | null }> {
  if (!payment.order_id) return { outcome: "unknown_order", code: null };

  return sql.begin(async (tx) => {
    const [row] = await tx<{ id: string; booking_id: string; amount_paise: number; status: string; code: string }[]>`
      select p.id, p.booking_id, p.amount_paise, p.status, b.code
      from payments p join bookings b on b.id = p.booking_id
      where p.rzp_order_id = ${payment.order_id ?? ""}
      for update of p`;
    if (!row) return { outcome: "unknown_order" as const, code: null };
    const result = (outcome: PaymentOutcome) => ({ outcome, code: row.code });

    if (payment.status === "failed" || payment.status === "created") {
      // Never let a failed retry overwrite a successful payment on the same order.
      if (payment.status === "failed") {
        await tx`update payments set status = 'failed', raw = ${tx.json(payment)}
                 where id = ${row.id} and status in ('created', 'failed')`;
      }
      return result(payment.status === "failed" ? "failed" : "processing");
    }

    if (payment.status === "refunded") return result("needs_review"); // refunds are a phase 2 flow

    // authorized or captured: record it, never downgrading captured → authorized.
    await tx`
      update payments
      set rzp_payment_id = ${payment.id},
          status = case when status = 'captured' then 'captured' else ${payment.status} end,
          raw = ${tx.json(payment)}
      where id = ${row.id}`;

    if (payment.status !== "captured") return result("processing");

    if (payment.amount !== row.amount_paise || payment.currency !== "INR") {
      await tx`update payments set needs_review = true where id = ${row.id}`;
      return result("needs_review");
    }

    const [booking] = await tx<{ status: string }[]>`
      select status from bookings where id = ${row.booking_id} for update`;

    if (booking.status === "confirmed" || booking.status === "completed") return result("already_confirmed");

    if (booking.status === "pending" || booking.status === "expired") {
      // A late payment for an expired hold still confirms if nobody has taken the slot since.
      try {
        await tx.savepoint((sp) => sp`
          update bookings set status = 'confirmed', hold_expires_at = null where id = ${row.booking_id}`);
        return result("confirmed");
      } catch (error) {
        if (!(error instanceof postgres.PostgresError && error.code === BLOCKED_BY_OTHER_BOOKING)) throw error;
      }
    }

    // Paid, but cancelled or the slot is gone: keep the money visible for the owner to refund.
    await tx`update payments set needs_review = true where id = ${row.id}`;
    return result("needs_review");
  });
}

/**
 * Fetches the payment from Razorpay (authoritative), captures it if it's only authorized, then
 * records it. Used by the verify endpoint and the payment.authorized webhook.
 */
export async function settlePayment(
  paymentId: string,
  opts: { expectedOrderId?: string } = {},
): Promise<{ outcome: PaymentOutcome; code: string | null; orderId: string | null }> {
  let payment = await fetchPayment(paymentId);
  // Never capture or record a payment that belongs to a different order than the caller expects.
  if (opts.expectedOrderId && payment.order_id !== opts.expectedOrderId) {
    return { outcome: "unknown_order", code: null, orderId: payment.order_id ?? null };
  }
  if (payment.status === "authorized") {
    try {
      payment = await capturePayment(payment.id, payment.amount);
    } catch (error) {
      // Already captured (e.g. auto-capture won the race): re-read the real state.
      if (!(error instanceof RazorpayApiError)) throw error;
      payment = await fetchPayment(paymentId);
    }
  }
  const { outcome, code } = await recordPayment(payment);
  return { outcome, code, orderId: payment.order_id ?? null };
}
