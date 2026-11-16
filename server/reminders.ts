import "server-only";
import { sql } from "@/lib/db";
import { onReminderDue } from "./notifications";

/**
 * Appointment reminders (phase 2): one email about a day before, decided by the owner
 * (2026-11-16: "Email, 24h before"). Run from the per-minute cron job; queued into email_outbox
 * and sent like every other email, so a reminder never blocks anything and never sends twice
 * (the outbox key includes the start time: a moved booking is reminded about its new time).
 */

export const REMINDER_HOURS = 24;
/** Too close to bother (e.g. the cron job was down): the customer already knows. */
export const REMINDER_MIN_LEAD_HOURS = 2;

/**
 * Queues reminders for confirmed bookings starting within REMINDER_HOURS. Bookings made less than
 * REMINDER_HOURS ahead are skipped: their confirmation email arrived moments ago.
 */
export async function queueDueReminders(now = new Date(), limit = 100): Promise<number> {
  const due = await sql<{ id: string }[]>`
    select b.id from bookings b join customers c on c.id = b.customer_id
    where b.status = 'confirmed'
      and c.email is not null
      and b.starts_at > ${now}::timestamptz + make_interval(hours => ${REMINDER_MIN_LEAD_HOURS})
      and b.starts_at <= ${now}::timestamptz + make_interval(hours => ${REMINDER_HOURS})
      and b.created_at <= b.starts_at - make_interval(hours => ${REMINDER_HOURS})
      and not exists (
        select 1 from email_outbox o
        where o.dedupe_key = 'reminder:' || b.id || ':' || floor(extract(epoch from b.starts_at))::bigint
      )
    order by b.starts_at
    limit ${limit}`;
  for (const { id } of due) await onReminderDue(sql, id, now);
  return due.length;
}
