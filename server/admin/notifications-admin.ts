import "server-only";
import { sql } from "@/lib/db";

/** In-app notifications for one admin user. Read state is per person. */

export type AdminNotification = {
  id: string;
  type: "booking_confirmed" | "payment_review" | "booking_cancelled" | "leave_requested" | "refund_failed" | "booking_rescheduled";
  title: string;
  body: string | null;
  bookingCode: string | null;
  createdAt: string;
  read: boolean;
};

/** Recent notifications (30 days, and only since the person joined, so new staff don't get a backlog). */
export async function listNotifications(userId: string, limit = 30): Promise<{ unread: number; items: AdminNotification[] }> {
  const visible = sql`
    n.created_at > now() - interval '30 days'
    and n.created_at >= (select created_at from users where id = ${userId})`;
  const [items, [{ unread }]] = await Promise.all([
    sql<AdminNotification[]>`
      select n.id, n.type, n.title, n.body, b.code as "bookingCode", to_json(n.created_at) #>> '{}' as "createdAt",
             (r.user_id is not null) as read
      from notifications n
      left join bookings b on b.id = n.booking_id
      left join notification_reads r on r.notification_id = n.id and r.user_id = ${userId}
      where ${visible}
      order by n.created_at desc limit ${limit}`,
    sql<{ unread: number }[]>`
      select count(*)::int as unread from notifications n
      where ${visible} and not exists (select 1 from notification_reads r where r.notification_id = n.id and r.user_id = ${userId})`,
  ]);
  return { unread, items };
}

export async function markNotificationsRead(userId: string, ids: string[] | "all"): Promise<void> {
  if (ids === "all") {
    await sql`
      insert into notification_reads (user_id, notification_id)
      select ${userId}, n.id from notifications n where n.created_at > now() - interval '30 days'
      on conflict do nothing`;
    return;
  }
  if (!ids.length) return;
  await sql`
    insert into notification_reads ${sql(ids.map((notification_id) => ({ user_id: userId, notification_id })))}
    on conflict do nothing`;
}
