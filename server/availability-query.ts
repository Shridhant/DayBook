import "server-only";
import { sql } from "@/lib/db";
import { istDayRange, timeToMinutes, weekdayOf, type DateKey } from "@/lib/time";
import {
  computeSlots,
  type BookingStatus,
  type CandidateStaff,
  type ClosedReason,
  type Slot,
} from "./availability";

/**
 * Loads everything availability needs for one date and runs the pure `computeSlots`.
 * Always fresh: never cache (AGENTS.md §5).
 */

export class AvailabilityError extends Error {
  constructor(
    public readonly code: "unknown_service" | "unknown_staff" | "staff_not_qualified",
    message: string,
  ) {
    super(message);
  }
}

export type AvailabilityResult = {
  date: DateKey;
  durationMin: number;
  closedReason: ClosedReason;
  slots: Slot[];
};

export async function getAvailability(params: {
  date: DateKey;
  serviceIds: string[];
  /** Restrict to one technician; omit for "Any available". */
  staffId?: string;
  now?: Date;
}): Promise<AvailabilityResult> {
  const { date, serviceIds, staffId } = params;
  const now = params.now ?? new Date();
  const weekday = weekdayOf(date);
  const day = istDayRange(date);

  const [[settings], services, hours, [closure]] = await Promise.all([
    sql<{ slot_interval_min: number; lead_time_min: number; booking_window_days: number }[]>`
      select slot_interval_min, lead_time_min, booking_window_days from settings`,
    sql<{ id: string; duration_min: number }[]>`
      select id, duration_min from services where active and id in ${sql(serviceIds)}`,
    sql<{ opens_at: string; closes_at: string }[]>`
      select opens_at, closes_at from opening_hours where weekday = ${weekday}`,
    sql<{ id: string }[]>`select id from salon_closures where date = ${date}`,
  ]);

  if (services.length !== serviceIds.length) {
    throw new AvailabilityError("unknown_service", "One or more services are unavailable.");
  }
  const durationMin = services.reduce((sum, s) => sum + s.duration_min, 0);

  // Active technicians qualified for every selected service.
  const qualified = await sql<{ id: string; sort_order: number }[]>`
    select st.id, st.sort_order
    from staff st
    join staff_services ss on ss.staff_id = st.id
    where st.active and ss.service_id in ${sql(serviceIds)}
      ${staffId ? sql`and st.id = ${staffId}` : sql``}
    group by st.id, st.sort_order
    having count(distinct ss.service_id) = ${serviceIds.length}`;

  if (staffId && qualified.length === 0) {
    const [exists] = await sql`select 1 from staff where id = ${staffId} and active`;
    throw exists
      ? new AvailabilityError("staff_not_qualified", "This artist doesn't offer all the selected services.")
      : new AvailabilityError("unknown_staff", "This artist isn't available.");
  }

  const staffIds = qualified.map((s) => s.id);
  const [shifts, bookings, leave] =
    staffIds.length === 0
      ? [[], [], []]
      : await Promise.all([
          sql<{ staff_id: string; starts_at: string; ends_at: string }[]>`
            select staff_id, starts_at, ends_at from staff_shifts
            where weekday = ${weekday} and staff_id in ${sql(staffIds)}`,
          sql<{ staff_id: string; starts_at: Date; ends_at: Date; status: BookingStatus; hold_expires_at: Date | null }[]>`
            select staff_id, starts_at, ends_at, status, hold_expires_at from bookings
            where staff_id in ${sql(staffIds)}
              and status in ('pending', 'confirmed', 'completed')
              and starts_at < ${day.end} and ends_at > ${day.start}`,
          sql<{ staff_id: string; starts_at: Date; ends_at: Date }[]>`
            select staff_id, starts_at, ends_at from staff_leave
            where status = 'approved' and staff_id in ${sql(staffIds)}
              and starts_at < ${day.end} and ends_at > ${day.start}`,
        ]);

  const staff: CandidateStaff[] = qualified.map((s) => ({
    id: s.id,
    sortOrder: s.sort_order,
    shifts: shifts
      .filter((sh) => sh.staff_id === s.id)
      .map((sh) => ({ start: timeToMinutes(sh.starts_at), end: timeToMinutes(sh.ends_at) })),
    bookings: bookings
      .filter((b) => b.staff_id === s.id)
      .map((b) => ({ start: b.starts_at, end: b.ends_at, status: b.status, holdExpiresAt: b.hold_expires_at })),
    leave: leave.filter((l) => l.staff_id === s.id).map((l) => ({ start: l.starts_at, end: l.ends_at })),
  }));

  const opening = hours[0]
    ? { start: timeToMinutes(hours[0].opens_at), end: timeToMinutes(hours[0].closes_at) }
    : null;

  const { slots, closedReason } = computeSlots({
    date,
    now,
    durationMin,
    rules: {
      slotIntervalMin: settings.slot_interval_min,
      leadTimeMin: settings.lead_time_min,
      bookingWindowDays: settings.booking_window_days,
    },
    openingHours: opening,
    closed: Boolean(closure),
    staff,
  });

  return { date, durationMin, closedReason, slots };
}
