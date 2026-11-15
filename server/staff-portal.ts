import "server-only";
import { nextStatus, staffActions, type BookingStatus, type StaffAction } from "@/lib/booking-status";
import { sql } from "@/lib/db";
import { istDayRange, timeToMinutes, toIst, weekdayOf, type DateKey } from "@/lib/time";
import { AdminError, notFound } from "./admin/http";
import { leaveRange, type LeaveInput } from "./admin/rules";
import { onLeaveRequested } from "./notifications";

/**
 * Technician portal (phase 2). Every function takes the signed-in technician's own staffId and
 * scopes every query to it (AGENTS.md §8); callers get that id from the session, never the client.
 */

/* ---------- Schedule ---------- */

export type StaffBooking = {
  id: string;
  code: string;
  status: BookingStatus;
  source: "online" | "walk_in" | "phone";
  startsAt: string;
  endsAt: string;
  customer: { name: string; phone: string | null };
  items: { name: string; durationMin: number }[];
  notes: string | null;
  /** What the technician can do right now (computed on the server at render time). */
  actions: StaffAction[];
};

export type StaffDay = {
  date: DateKey;
  /** IST minutes since midnight. */
  shifts: { start: number; end: number }[];
  leave: { start: number; end: number }[];
  closureReason: string | null;
  bookings: StaffBooking[];
};

export async function getStaffDay(staffId: string, date: DateKey, now = new Date()): Promise<StaffDay> {
  const day = istDayRange(date);
  const [[settings], shifts, leave, [closure], rows] = await Promise.all([
    sql<{ show_customer_phone_to_staff: boolean }[]>`select show_customer_phone_to_staff from settings`,
    sql<{ starts_at: string; ends_at: string }[]>`
      select starts_at, ends_at from staff_shifts where staff_id = ${staffId} and weekday = ${weekdayOf(date)} order by starts_at`,
    sql<{ starts_at: Date; ends_at: Date }[]>`
      select starts_at, ends_at from staff_leave
      where staff_id = ${staffId} and status = 'approved' and starts_at < ${day.end} and ends_at > ${day.start}`,
    sql<{ reason: string | null }[]>`select reason from salon_closures where date = ${date}`,
    sql<
      {
        id: string; code: string; status: BookingStatus; source: StaffBooking["source"]; starts_at: Date; ends_at: Date;
        customer_name: string; customer_phone: string; notes: string | null; items: StaffBooking["items"] | null;
      }[]
    >`
      select b.id, b.code, b.status, b.source, b.starts_at, b.ends_at, c.name as customer_name, c.phone as customer_phone, b.notes,
             (select json_agg(json_build_object('name', i.name_snapshot, 'durationMin', i.duration_snapshot_min) order by i.position)
              from booking_items i where i.booking_id = b.id) as items
      from bookings b join customers c on c.id = b.customer_id
      where b.staff_id = ${staffId} and b.status in ('confirmed', 'completed', 'no_show')
        and b.starts_at >= ${day.start} and b.starts_at < ${day.end}
      order by b.starts_at`,
  ]);

  const clip = (start: Date, end: Date) => ({
    start: start <= day.start ? 0 : toIst(start).minutes,
    end: end >= day.end ? 1440 : toIst(end).minutes,
  });

  return {
    date,
    shifts: shifts.map((s) => ({ start: timeToMinutes(s.starts_at), end: timeToMinutes(s.ends_at) })),
    leave: leave.map((l) => clip(l.starts_at, l.ends_at)),
    closureReason: closure ? (closure.reason ?? "Closed") : null,
    bookings: rows.map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      source: r.source,
      startsAt: r.starts_at.toISOString(),
      endsAt: r.ends_at.toISOString(),
      // Hidden unless the owner allows it in Settings (AGENTS.md §8).
      customer: { name: r.customer_name, phone: settings.show_customer_phone_to_staff ? r.customer_phone : null },
      items: r.items ?? [],
      notes: r.notes,
      actions: staffActions(r.status, r.starts_at, now),
    })),
  };
}

/** Marks one of the technician's own bookings done / no-show, or undoes that. */
export async function applyStaffAction(staffId: string, bookingId: string, action: StaffAction, now = new Date()): Promise<void> {
  const [booking] = await sql<{ status: BookingStatus; starts_at: Date }[]>`
    select status, starts_at from bookings where id = ${bookingId} and staff_id = ${staffId}`;
  // Someone else's booking looks exactly like a missing one.
  if (!booking) throw notFound("Booking");
  if (!staffActions(booking.status, booking.starts_at, now).includes(action)) {
    throw new AdminError(409, "not_allowed", booking.starts_at > now ? "You can mark this once the appointment starts." : "This booking can't be changed that way.");
  }
  const next = nextStatus(booking.status, action);
  // Conditional on the status we read, so a front-desk change at the same moment wins cleanly.
  const [updated] = await sql`
    update bookings set status = ${next}
    where id = ${bookingId} and staff_id = ${staffId} and status = ${booking.status}
    returning id`;
  if (!updated) throw new AdminError(409, "conflict", "This booking just changed. Refresh and try again.");
}

/* ---------- Leave requests ---------- */

export type LeaveStatus = "requested" | "approved" | "rejected";

export type OwnLeave = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  status: LeaveStatus;
  decisionNote: string | null;
};

/** Open requests a technician can have at once, so a mistake can't flood the front desk. */
export const MAX_OPEN_REQUESTS = 5;

/** Upcoming leave and anything decided in the last 30 days. */
export async function listOwnLeave(staffId: string): Promise<OwnLeave[]> {
  const rows = await sql<{ id: string; starts_at: Date; ends_at: Date; reason: string | null; status: LeaveStatus; decision_note: string | null }[]>`
    select id, starts_at, ends_at, reason, status, decision_note from staff_leave
    where staff_id = ${staffId} and (ends_at > now() or (status <> 'requested' and coalesce(decided_at, created_at) > now() - interval '30 days'))
    order by starts_at`;
  return rows.map((r) => ({
    id: r.id,
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at.toISOString(),
    reason: r.reason,
    status: r.status,
    decisionNote: r.decision_note,
  }));
}

export async function requestLeave(user: { id: string; staffId: string }, input: LeaveInput & { reason?: string | null }): Promise<{ id: string }> {
  const range = leaveRange(input);
  if ("error" in range) throw new AdminError(400, "invalid_leave", range.error);
  if (range.end <= new Date()) throw new AdminError(400, "invalid_leave", "Choose dates in the future.");

  return sql.begin(async (tx) => {
    // Serialises this technician's requests, so two quick taps can't both pass the checks below.
    await tx`select id from staff where id = ${user.staffId} for update`;
    const [{ open }] = await tx<{ open: number }[]>`
      select count(*)::int as open from staff_leave where staff_id = ${user.staffId} and status = 'requested' and ends_at > now()`;
    if (open >= MAX_OPEN_REQUESTS) {
      throw new AdminError(409, "too_many_requests", `You already have ${open} requests waiting. Wait for the front desk to answer them first.`);
    }
    const [overlap] = await tx<{ status: LeaveStatus }[]>`
      select status from staff_leave
      where staff_id = ${user.staffId} and status in ('requested', 'approved') and starts_at < ${range.end} and ends_at > ${range.start}
      limit 1`;
    if (overlap) {
      throw new AdminError(409, "overlap", overlap.status === "approved" ? "You already have approved leave then." : "You've already asked for leave then.");
    }
    const [row] = await tx<{ id: string }[]>`
      insert into staff_leave (staff_id, starts_at, ends_at, reason, status, requested_by)
      values (${user.staffId}, ${range.start}, ${range.end}, ${input.reason?.trim() || null}, 'requested', ${user.id})
      returning id`;
    await onLeaveRequested(tx, row.id);
    return { id: row.id };
  });
}

/** Withdraws a request that hasn't been answered yet. Approved leave is changed by the front desk. */
export async function withdrawLeave(staffId: string, leaveId: string): Promise<void> {
  const [row] = await sql`delete from staff_leave where id = ${leaveId} and staff_id = ${staffId} and status = 'requested' returning id`;
  if (!row) throw new AdminError(409, "not_allowed", "This request was already answered. Ask the front desk to change it.");
}
