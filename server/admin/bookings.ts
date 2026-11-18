import "server-only";
import { sql } from "@/lib/db";
import { istDayRange, istToday, timeToMinutes, toIst, weekdayOf, type DateKey } from "@/lib/time";
import type { BookingStatus } from "../availability";
import { getAvailability } from "../availability-query";
import { insertBooking, loadServicesInOrder } from "../booking-insert";
import { nextStatus, type AdminAction } from "@/lib/booking-status";
import { totalPrice } from "@/lib/pricing";
import { onBookingCancelled } from "../notifications";

/**
 * Admin booking operations: day schedule, bookings list, status actions, walk-in/phone bookings.
 * Always fresh, never cached (AGENTS.md §5). Callers must have checked the user's role.
 */

export type AdminRefund = {
  id: string;
  amountPaise: number;
  status: "creating" | "pending" | "processed" | "failed";
  source: "admin" | "auto" | "dashboard";
  reason: string | null;
  failureReason: string | null;
  createdAt: string;
};

/** Serializable booking for admin UIs (server → client props, JSON). */
export type AdminBooking = {
  id: string;
  code: string;
  status: BookingStatus;
  source: "online" | "walk_in" | "phone";
  startsAt: string;
  endsAt: string;
  date: DateKey;
  /** IST minutes since midnight, for positioning on the calendar. */
  startMin: number;
  endMin: number;
  staffId: string;
  staffName: string;
  customer: { name: string; phone: string };
  items: { name: string; pricePaise: number; durationMin: number }[];
  /** Category of the first service, for colour-coding; `tone` is its position among categories. */
  category: { name: string; tone: number } | null;
  totalPaise: number;
  amountDueNowPaise: number;
  /** Captured online, net of refunds. */
  paidPaise: number;
  /** Money was taken but the booking is cancelled or flagged: the owner must refund or resolve. */
  refundDue: boolean;
  refunds: AdminRefund[];
  notes: string | null;
  cancelReason: string | null;
  holdExpiresAt: string | null;
};

type BookingRow = {
  id: string;
  code: string;
  status: BookingStatus;
  source: AdminBooking["source"];
  starts_at: Date;
  ends_at: Date;
  staff_id: string;
  staff_name: string;
  customer_name: string;
  customer_phone: string;
  total_paise: number;
  amount_due_now_paise: number;
  paid_paise: number;
  needs_review: boolean;
  notes: string | null;
  cancel_reason: string | null;
  hold_expires_at: Date | null;
  items: AdminBooking["items"] | null;
  category: AdminBooking["category"];
  refunds: AdminRefund[] | null;
};

const bookingColumns = sql`
  b.id, b.code, b.status, b.source, b.starts_at, b.ends_at, b.staff_id, st.name as staff_name,
  c.name as customer_name, c.phone as customer_phone, b.total_paise, b.amount_due_now_paise,
  b.notes, b.cancel_reason, b.hold_expires_at,
  coalesce((select sum(p.amount_paise - p.refunded_paise) from payments p
            where p.booking_id = b.id and p.status = 'captured'), 0)::int as paid_paise,
  coalesce((select bool_or(p.needs_review) from payments p where p.booking_id = b.id), false) as needs_review,
  (select json_agg(json_build_object('name', i.name_snapshot, 'pricePaise', i.price_snapshot_paise,
                                     'durationMin', i.duration_snapshot_min) order by i.position)
   from booking_items i where i.booking_id = b.id) as items,
  (select json_build_object('name', sc.name,
                            'tone', (select count(*) from service_categories x
                                     where (x.sort_order, x.id) < (sc.sort_order, sc.id))::int)
   from booking_items i join services sv on sv.id = i.service_id join service_categories sc on sc.id = sv.category_id
   where i.booking_id = b.id order by i.position limit 1) as category,
  (select json_agg(json_build_object('id', r.id, 'amountPaise', r.amount_paise, 'status', r.status, 'source', r.source,
                                     'reason', r.reason, 'failureReason', r.failure_reason, 'createdAt', r.created_at)
                   order by r.created_at)
   from refunds r where r.booking_id = b.id) as refunds`;

/** Hide lapsed holds and expired rows: they no longer hold a slot. */
const liveBookings = sql`b.status <> 'expired' and not (b.status = 'pending' and b.hold_expires_at <= now())`;

function toAdminBooking(r: BookingRow): AdminBooking {
  const start = toIst(r.starts_at);
  const end = toIst(r.ends_at);
  return {
    id: r.id,
    code: r.code,
    status: r.status,
    source: r.source,
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at.toISOString(),
    date: start.date,
    startMin: start.minutes,
    endMin: end.date === start.date ? end.minutes : 1440,
    staffId: r.staff_id,
    staffName: r.staff_name,
    customer: { name: r.customer_name, phone: r.customer_phone },
    items: r.items ?? [],
    category: r.category,
    totalPaise: r.total_paise,
    amountDueNowPaise: r.amount_due_now_paise,
    paidPaise: r.paid_paise,
    refundDue: r.needs_review || (r.status === "cancelled" && r.paid_paise > 0),
    refunds: r.refunds ?? [],
    notes: r.notes,
    cancelReason: r.cancel_reason,
    holdExpiresAt: r.hold_expires_at?.toISOString() ?? null,
  };
}

/* ---------- Day schedule ---------- */

export type ScheduleStaff = {
  id: string;
  name: string;
  shifts: { start: number; end: number }[];
  /** Approved leave clipped to the day, IST minutes. */
  leave: { start: number; end: number }[];
};

export type DaySchedule = {
  date: DateKey;
  opening: { start: number; end: number } | null;
  closureReason: string | null;
  staff: ScheduleStaff[];
  bookings: AdminBooking[];
  /** Online payments captured today (by payment time), net of refunds. */
  collectedTodayPaise: number;
};

export async function getDaySchedule(date: DateKey): Promise<DaySchedule> {
  const day = istDayRange(date);
  const weekday = weekdayOf(date);

  const [hours, [closure], staff, shifts, leave, bookings, [collected]] = await Promise.all([
    sql<{ opens_at: string; closes_at: string }[]>`select opens_at, closes_at from opening_hours where weekday = ${weekday}`,
    sql<{ reason: string | null }[]>`select coalesce(reason, 'Closed') as reason from salon_closures where date = ${date}`,
    // Active staff, plus anyone inactive who still has a booking that day.
    sql<{ id: string; name: string }[]>`
      select id, name from staff st
      where st.active or exists (select 1 from bookings b where b.staff_id = st.id
                                 and b.starts_at < ${day.end} and b.ends_at > ${day.start} and b.status <> 'expired')
      order by sort_order, name`,
    sql<{ staff_id: string; starts_at: string; ends_at: string }[]>`
      select staff_id, starts_at, ends_at from staff_shifts where weekday = ${weekday} order by starts_at`,
    sql<{ staff_id: string; starts_at: Date; ends_at: Date }[]>`
      select staff_id, starts_at, ends_at from staff_leave
      where status = 'approved' and starts_at < ${day.end} and ends_at > ${day.start}`,
    sql<BookingRow[]>`
      select ${bookingColumns}
      from bookings b join staff st on st.id = b.staff_id join customers c on c.id = b.customer_id
      where b.starts_at < ${day.end} and b.ends_at > ${day.start} and ${liveBookings}
      order by b.starts_at`,
    sql<{ total: number }[]>`
      select coalesce(sum(amount_paise - refunded_paise), 0)::int as total from payments
      where status = 'captured' and updated_at >= ${day.start} and updated_at < ${day.end}`,
  ]);

  const clip = (at: Date, edge: "start" | "end") => {
    if (at <= day.start) return 0;
    if (at >= day.end) return 1440;
    return toIst(at).minutes || (edge === "end" ? 1440 : 0);
  };

  return {
    date,
    opening: hours[0] ? { start: timeToMinutes(hours[0].opens_at), end: timeToMinutes(hours[0].closes_at) } : null,
    closureReason: closure?.reason ?? null,
    staff: staff.map((s) => ({
      id: s.id,
      name: s.name,
      shifts: shifts.filter((sh) => sh.staff_id === s.id).map((sh) => ({ start: timeToMinutes(sh.starts_at), end: timeToMinutes(sh.ends_at) })),
      leave: leave.filter((l) => l.staff_id === s.id).map((l) => ({ start: clip(l.starts_at, "start"), end: clip(l.ends_at, "end") })),
    })),
    bookings: bookings.map(toAdminBooking),
    collectedTodayPaise: collected.total,
  };
}

/* ---------- Bookings list ---------- */

/** upcoming: from today, soonest first · newest: most recently made first · latest: by date, latest first. */
export const BOOKING_SORTS = ["upcoming", "newest", "latest"] as const;
export type BookingSort = (typeof BOOKING_SORTS)[number];

export type BookingFilters = {
  q?: string;
  sort?: BookingSort;
  status?: BookingStatus | "active";
  from?: DateKey;
  to?: DateKey;
  page?: number;
};

export const PAGE_SIZE = 25;

export async function listBookings(filters: BookingFilters): Promise<{ rows: AdminBooking[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const q = filters.q?.trim();
  const digits = q?.replace(/\D/g, "");
  const conditions = [liveBookings];

  const sort = filters.sort ?? "upcoming";
  if (filters.from) conditions.push(sql`b.starts_at >= ${istDayRange(filters.from).start}`);
  else if (sort === "upcoming") conditions.push(sql`b.starts_at >= ${istDayRange(istToday()).start}`);
  if (filters.to) conditions.push(sql`b.starts_at < ${istDayRange(filters.to).end}`);
  if (filters.status === "active") conditions.push(sql`b.status in ('pending', 'confirmed')`);
  else if (filters.status) conditions.push(sql`b.status = ${filters.status}`);
  if (q) {
    // Search by booking code, customer name or phone (any 4+ digits).
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(
      digits && digits.length >= 4
        ? sql`(c.phone like ${`%${digits.slice(-10)}%`} or b.code ilike ${like})`
        : sql`(c.name ilike ${like} or b.code ilike ${like})`,
    );
  }
  const where = conditions.reduce((acc, c) => sql`${acc} and ${c}`);

  const [rows, [{ total }]] = await Promise.all([
    sql<BookingRow[]>`
      select ${bookingColumns}
      from bookings b join staff st on st.id = b.staff_id join customers c on c.id = b.customer_id
      where ${where}
      order by ${sort === "upcoming" ? sql`b.starts_at asc` : sort === "newest" ? sql`b.created_at desc` : sql`b.starts_at desc`}, b.id
      limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
    sql<{ total: number }[]>`
      select count(*)::int as total
      from bookings b join customers c on c.id = b.customer_id
      where ${where}`,
  ]);
  return { rows: rows.map(toAdminBooking), total };
}

export async function getAdminBooking(id: string): Promise<AdminBooking | null> {
  const [row] = await sql<BookingRow[]>`
    select ${bookingColumns}
    from bookings b join staff st on st.id = b.staff_id join customers c on c.id = b.customer_id
    where b.id = ${id}`;
  return row ? toAdminBooking(row) : null;
}

/* ---------- Status actions ---------- */

export class AdminBookingError extends Error {
  constructor(
    public readonly code: "not_found" | "not_allowed" | "conflict" | "slot_unavailable" | "slot_taken",
    message: string,
  ) {
    super(message);
  }
}

export async function applyBookingAction(params: {
  bookingId: string;
  action: AdminAction;
  reason?: string;
  /** Who did it, for the in-app notification. */
  actorName?: string;
}): Promise<AdminBooking> {
  const [current] = await sql<{ status: BookingStatus }[]>`select status from bookings where id = ${params.bookingId}`;
  if (!current) throw new AdminBookingError("not_found", "Booking not found.");

  const next = nextStatus(current.status, params.action);
  if (!next) throw new AdminBookingError("not_allowed", `A ${current.status.replace("_", "-")} booking can't be changed that way.`);

  // Conditional on the status we read, so two people acting at once can't both win.
  await sql.begin(async (tx) => {
    const [updated] = await tx<{ id: string }[]>`
      update bookings set
        status = ${next},
        hold_expires_at = null,
        cancelled_at = ${next === "cancelled" ? tx`now()` : null},
        cancel_reason = ${next === "cancelled" ? params.reason?.trim() || null : null}
      where id = ${params.bookingId} and status = ${current.status}
      returning id`;
    if (!updated) throw new AdminBookingError("conflict", "This booking just changed. Refresh and try again.");
    if (next === "cancelled") await onBookingCancelled(tx, params.bookingId, params.actorName ?? "the front desk");
  });

  const booking = await getAdminBooking(params.bookingId);
  if (!booking) throw new AdminBookingError("not_found", "Booking not found.");
  return booking;
}

/* ---------- Walk-in / phone bookings ---------- */

export type AdminBookingRequest = {
  serviceIds: string[];
  staffId?: string;
  date: DateKey;
  startMinutes: number;
  customer: { name: string; phone: string };
  source: "walk_in" | "phone";
  notes?: string;
  createdByUserId: string;
};

/** Creates a confirmed booking with nothing paid online (it's settled at the studio). */
export async function createAdminBooking(request: AdminBookingRequest): Promise<AdminBooking> {
  const availability = await getAvailability({
    date: request.date,
    serviceIds: request.serviceIds,
    staffId: request.staffId,
    forAdmin: true,
  });
  const slot = availability.slots.find((s) => s.minutes === request.startMinutes);
  if (!slot) throw new AdminBookingError("slot_unavailable", "That time isn't available any more. Pick another slot.");

  const items = await loadServicesInOrder(request.serviceIds);
  const total = totalPrice(items.map((s) => ({ pricePaise: s.price_paise, bookingAmountOverridePaise: null })));

  const bookingId = await sql.begin(async (tx) => {
    await tx`update bookings set status = 'expired' where status = 'pending' and hold_expires_at <= now()`;
    // The front desk is trusted to correct a customer's name.
    const [customer] = await tx<{ id: string }[]>`
      insert into customers (name, phone) values (${request.customer.name}, ${request.customer.phone})
      on conflict (phone) do update set name = excluded.name
      returning id`;
    const inserted = await insertBooking(tx, {
      customerId: customer.id,
      customerEmail: null,
      candidateStaffIds: slot.staffIds,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: "confirmed",
      source: request.source,
      totalPaise: total,
      amountDueNowPaise: 0,
      holdMinutes: null,
      notes: request.notes?.trim() || null,
      createdByUserId: request.createdByUserId,
      items,
    });
    if (!inserted) throw new AdminBookingError("slot_taken", "Someone just booked that time. Pick another slot.");
    return inserted.id;
  });

  const booking = await getAdminBooking(bookingId);
  if (!booking) throw new AdminBookingError("not_found", "Booking not found.");
  return booking;
}
