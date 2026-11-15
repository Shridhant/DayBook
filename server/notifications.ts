import "server-only";
import type { Sql, TransactionSql } from "postgres";
import { env } from "@/lib/env";
import { buildIcs } from "@/lib/ics";
import { site } from "@/lib/site";
import {
  customerConfirmationEmail,
  ownerBookingConfirmedEmail,
  ownerPaymentReviewEmail,
  type BookingSummary,
  type EmailContent,
} from "./email-templates";

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
      content: customerConfirmationEmail(b, site.name, { address: site.address, cancelWindowHours: settings.cancel_window_hours }),
      ics: buildIcs({
        uid: `${b.id}@daybook`,
        title: `${site.name}: ${b.items.map((i) => i.name).join(", ")}`,
        start: b.startsAt,
        end: b.endsAt,
        description: `Booking ${b.code} with ${b.staffName}.`,
        location: site.address || undefined,
      }),
    });
  }
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

/** Front desk cancelled a booking. In-app only (the person who cancelled already knows). */
export async function onBookingCancelled(db: Db, bookingId: string, byName: string): Promise<void> {
  const b = await loadSummary(db, bookingId);
  if (!b) return;
  await addNotification(db, {
    type: "booking_cancelled",
    title: `Cancelled: ${b.customerName}`,
    body: `${b.code} was cancelled by ${byName}${b.paidPaise > 0 ? `. ${b.paidPaise / 100} rupees paid online: refund due.` : "."}`,
    bookingId: b.id,
    dedupeKey: `booking_cancelled:${b.id}`,
  });
}
