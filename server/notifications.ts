import "server-only";
import type { Sql, TransactionSql } from "postgres";
import { env } from "@/lib/env";
import { buildIcs } from "@/lib/ics";
import { formatINR } from "@/lib/money";
import { site } from "@/lib/site";
import { formatDate, formatInstantTime, formatLeaveRange, toIst } from "@/lib/time";
import {
  customerConfirmationEmail,
  customerRefundEmail,
  customerRescheduledEmail,
  ownerBookingConfirmedEmail,
  ownerPaymentReviewEmail,
  ownerRefundFailedEmail,
  type BookingSummary,
  type EmailContent,
} from "./email-templates";
import { manageUrl } from "./manage-link";

/**
 * Booking events → in-app notifications + queued emails (AGENTS.md §7). Called inside the same
 * transaction as the change, so a notification exists exactly when the change committed. Every
 * insert is keyed (dedupe_key), so retries (webhooks, verify + webhook racing) never duplicate.
 * Sending happens later in server/email.ts and can never break a booking.
 */

type Db = Sql | TransactionSql;

async function loadSummary(db: Db, bookingId: string): Promise<BookingSummary | null> {
  const [row] = await db<
    {
      id: string; code: string; source: BookingSummary["source"]; customer_name: string; customer_phone: string; customer_email: string | null;
      staff_name: string; starts_at: Date; ends_at: Date; total_paise: number; paid_paise: number; notes: string | null;
      items: { name: string; pricePaise: number }[] | null;
    }[]
  >`
    select b.id, b.code, b.source, c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
           st.name as staff_name, b.starts_at, b.ends_at, b.total_paise, b.notes,
           coalesce((select sum(p.amount_paise - p.refunded_paise) from payments p
                     where p.booking_id = b.id and p.status = 'captured'), 0)::int as paid_paise,
           (select json_agg(json_build_object('name', i.name_snapshot, 'pricePaise', i.price_snapshot_paise) order by i.position)
            from booking_items i where i.booking_id = b.id) as items
    from bookings b join customers c on c.id = b.customer_id join staff st on st.id = b.staff_id
    where b.id = ${bookingId}`;
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    source: row.source,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    staffName: row.staff_name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    items: row.items ?? [],
    totalPaise: row.total_paise,
    paidPaise: row.paid_paise,
    notes: row.notes,
  };
}

async function addNotification(db: Db, n: { type: string; title: string; body: string; bookingId: string; dedupeKey: string }) {
  await db`
    insert into notifications (type, title, body, booking_id, dedupe_key)
    values (${n.type}, ${n.title}, ${n.body}, ${n.bookingId}, ${n.dedupeKey})
    on conflict (dedupe_key) do nothing`;
}

async function queueEmail(db: Db, e: { to: string; dedupeKey: string; content: EmailContent; ics?: string }) {
  await db`
    insert into email_outbox (dedupe_key, to_email, subject, html, text_body, ics)
    values (${e.dedupeKey}, ${e.to}, ${e.content.subject}, ${e.content.html}, ${e.content.text}, ${e.ics ?? null})
    on conflict (dedupe_key) do nothing`;
}

/** A booking just became confirmed (online payment captured, or a ₹0 online booking). */
export async function onBookingConfirmed(db: Db, bookingId: string): Promise<void> {
  const b = await loadSummary(db, bookingId);
  if (!b || b.source !== "online") return; // front-desk bookings were made in the admin: no alert needed

  await addNotification(db, {
    type: "booking_confirmed",
    title: `New booking: ${b.customerName}`,
    body: `${b.code} · ${b.items.map((i) => i.name).join(", ")} with ${b.staffName}`,
    bookingId: b.id,
    dedupeKey: `booking_confirmed:${b.id}`,
  });

  const ownerEmail = ownerBookingConfirmedEmail(b, site.name);
  for (const to of env.OWNER_NOTIFY_EMAILS) {
    await queueEmail(db, { to, dedupeKey: `owner_confirmed:${b.id}:${to}`, content: ownerEmail });
  }

  if (b.customerEmail) {
    const [settings] = await db<{ cancel_window_hours: number }[]>`select cancel_window_hours from settings`;
    await queueEmail(db, {
      to: b.customerEmail,
      dedupeKey: `customer_confirmed:${b.id}`,
      content: customerConfirmationEmail(b, site.name, {
        address: site.address,
        cancelWindowHours: settings.cancel_window_hours,
        manageUrl: manageUrl(b.code, b.id),
      }),
      ics: bookingIcs(b, 0),
    });
  }
}

/** Calendar invite for a booking. Same UID for its whole life; `sequence` grows with each move. */
function bookingIcs(b: BookingSummary, sequence: number) {
  return buildIcs({
    uid: `${b.id}@daybook`,
    title: `${site.name}: ${b.items.map((i) => i.name).join(", ")}`,
    start: b.startsAt,
    end: b.endsAt,
    description: `Booking ${b.code} with ${b.staffName}. Manage it: ${manageUrl(b.code, b.id)}`,
    location: site.address || undefined,
    sequence,
  });
}

/** Money arrived but the owner must act (refund, slot taken, wrong amount). */
export async function onPaymentNeedsReview(db: Db, bookingId: string, paymentKey: string, reason: string): Promise<void> {
  const b = await loadSummary(db, bookingId);
  if (!b) return;
  await addNotification(db, {
    type: "payment_review",
    title: `Payment needs attention: ${b.code}`,
    body: reason,
    bookingId: b.id,
    dedupeKey: `payment_review:${b.id}:${paymentKey}`,
  });
  const email = ownerPaymentReviewEmail(b, reason, site.name);
  for (const to of env.OWNER_NOTIFY_EMAILS) {
    await queueEmail(db, { to, dedupeKey: `owner_review:${b.id}:${paymentKey}:${to}`, content: email });
  }
}

/**
 * A booking was cancelled (front desk or the customer's manage link). In-app only. `money`
 * describes what happens to an online payment; by default it's left for the owner to refund.
 */
export async function onBookingCancelled(db: Db, bookingId: string, byName: string, money?: string): Promise<void> {
  const b = await loadSummary(db, bookingId);
  if (!b) return;
  const moneyNote = b.paidPaise > 0 ? ` ${money ?? `${formatINR(b.paidPaise)} paid online: refund due.`}` : "";
  await addNotification(db, {
    type: "booking_cancelled",
    title: `Cancelled: ${b.customerName}`,
    body: `${b.code} was cancelled by ${byName}.${moneyNote}`,
    bookingId: b.id,
    dedupeKey: `booking_cancelled:${b.id}`,
  });
}

/**
 * A technician asked for time off: tell the front desk in the admin bell (in-app only, no email).
 * Keyed by the request, so it can't notify twice; withdrawing the request removes it (cascade).
 */
export async function onLeaveRequested(db: Db, leaveId: string): Promise<void> {
  const [row] = await db<{ staff_name: string; starts_at: Date; ends_at: Date; reason: string | null }[]>`
    select st.name as staff_name, l.starts_at, l.ends_at, l.reason
    from staff_leave l join staff st on st.id = l.staff_id where l.id = ${leaveId}`;
  if (!row) return;
  const when = formatLeaveRange(row.starts_at, row.ends_at);
  await db`
    insert into notifications (type, title, body, staff_leave_id, dedupe_key)
    values ('leave_requested', ${`Leave request: ${row.staff_name}`}, ${row.reason ? `${when} · ${row.reason}` : when},
            ${leaveId}, ${`leave_requested:${leaveId}`})
    on conflict (dedupe_key) do nothing`;
}

async function loadRefund(db: Db, refundId: string) {
  const [row] = await db<{ booking_id: string; amount_paise: number }[]>`select booking_id, amount_paise from refunds where id = ${refundId}`;
  return row;
}

// Refund keys include the booking id, like every booking event, so they're findable per booking.

/** Razorpay accepted a refund: tell the customer (if they gave an email). Owner already knows: they clicked it. */
export async function onRefundStarted(db: Db, refundId: string): Promise<void> {
  const refund = await loadRefund(db, refundId);
  if (!refund) return;
  const b = await loadSummary(db, refund.booking_id);
  if (!b?.customerEmail) return;
  await queueEmail(db, {
    to: b.customerEmail,
    dedupeKey: `customer_refund:${b.id}:${refundId}`,
    content: customerRefundEmail(b, refund.amount_paise, site.name),
  });
}

/** A refund was rejected or failed: the money is still with the salon and someone has to act. */
export async function onRefundFailed(db: Db, refundId: string, reason: string): Promise<void> {
  const refund = await loadRefund(db, refundId);
  if (!refund) return;
  const b = await loadSummary(db, refund.booking_id);
  if (!b) return;
  await addNotification(db, {
    type: "refund_failed",
    title: `Refund failed: ${b.code}`,
    body: `${formatINR(refund.amount_paise)} to ${b.customerName}. ${reason}`,
    bookingId: b.id,
    dedupeKey: `refund_failed:${b.id}:${refundId}`,
  });
  const email = ownerRefundFailedEmail(b, refund.amount_paise, reason, site.name);
  for (const to of env.OWNER_NOTIFY_EMAILS) {
    await queueEmail(db, { to, dedupeKey: `owner_refund_failed:${b.id}:${refundId}:${to}`, content: email });
  }
}

/** The customer moved their booking with the manage link: tell the front desk, send a new invite. */
export async function onBookingRescheduled(db: Db, bookingId: string, previous: { startsAt: Date; staffName: string }, sequence: number): Promise<void> {
  const b = await loadSummary(db, bookingId);
  if (!b) return;
  const fmt = (d: Date) => `${formatDate(toIst(d).date)} ${formatInstantTime(d)}`;
  const artist = previous.staffName === b.staffName ? `with ${b.staffName}` : `now with ${b.staffName} (was ${previous.staffName})`;
  await addNotification(db, {
    type: "booking_rescheduled",
    title: `Moved: ${b.customerName}`,
    body: `${b.code}: ${fmt(previous.startsAt)} → ${fmt(b.startsAt)}, ${artist}`,
    bookingId: b.id,
    dedupeKey: `booking_rescheduled:${b.id}:${sequence}`,
  });
  if (b.customerEmail) {
    await queueEmail(db, {
      to: b.customerEmail,
      dedupeKey: `customer_rescheduled:${b.id}:${sequence}`,
      content: customerRescheduledEmail(b, site.name, { address: site.address, manageUrl: manageUrl(b.code, b.id) }),
      ics: bookingIcs(b, sequence),
    });
  }
}
