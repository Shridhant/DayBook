import "server-only";
import { addDays, daysBetween, fromIst, istToday, MINUTES_PER_DAY, type DateKey } from "@/lib/time";

/**
 * Slot availability (AGENTS.md §7 "Availability"). Pure functions over data already loaded from
 * the database, so every rule is unit-testable. Loading lives in `availability-query.ts`.
 *
 * A start time is offered when at least one candidate technician:
 *   1. is qualified for every selected service (callers pass only qualified staff),
 *   2. has a shift covering the whole [start, start + duration),
 *   3. is not on approved leave and has no blocking booking overlapping it,
 * and the salon is open (not closed that day, inside opening hours), the start is at least
 * `leadTimeMin` from now, and the date is inside the booking window.
 */

/** Wall-clock minutes since IST midnight, end-exclusive. */
export type MinuteRange = { start: number; end: number };
/** Real instants, end-exclusive. */
export type InstantRange = { start: Date; end: Date };

import type { BookingStatus } from "@/lib/booking-status";

export type { BookingStatus };

export type ExistingBooking = InstantRange & { status: BookingStatus; holdExpiresAt: Date | null };

export type CandidateStaff = {
  id: string;
  sortOrder: number;
  /** Shifts for this weekday. */
  shifts: MinuteRange[];
  /** This technician's bookings overlapping the day (any status; filtering happens here). */
  bookings: ExistingBooking[];
  /** Approved leave overlapping the day. */
  leave: InstantRange[];
};

export type AvailabilityRules = {
  slotIntervalMin: number;
  leadTimeMin: number;
  bookingWindowDays: number;
};

export type AvailabilityInput = {
  date: DateKey;
  now: Date;
  durationMin: number;
  rules: AvailabilityRules;
  /** Opening hours for this weekday; null = closed that weekday. */
  openingHours: MinuteRange | null;
  /** A salon_closures row exists for the date. */
  closed: boolean;
  staff: CandidateStaff[];
};

export type Slot = {
  /** Minutes since IST midnight. */
  minutes: number;
  startsAt: Date;
  endsAt: Date;
  /** Technicians free for the whole slot, best "Any available" choice first. */
  staffIds: string[];
};

export type ClosedReason = "past" | "outside_window" | "closed" | "no_staff" | null;

/* ---------- Small rules (exported for tests and the hold step) ---------- */

/** Does an existing booking block its time? Confirmed/completed always; pending only while the hold is live. */
export function isBlocking(booking: ExistingBooking, now: Date): boolean {
  if (booking.status === "confirmed" || booking.status === "completed") return true;
  if (booking.status === "pending") return booking.holdExpiresAt !== null && booking.holdExpiresAt > now;
  return false;
}

export function overlaps(a: InstantRange, b: InstantRange): boolean {
  return a.start < b.end && b.start < a.end;
}

function covers(range: MinuteRange, start: number, end: number): boolean {
  return range.start <= start && end <= range.end;
}

/** Why a whole date offers nothing, or null if it may have slots. Checked before generating slots. */
export function dateClosedReason(input: Pick<AvailabilityInput, "date" | "now" | "rules" | "openingHours" | "closed" | "staff">): ClosedReason {
  const offset = daysBetween(istToday(input.now), input.date);
  if (offset < 0) return "past";
  if (offset >= input.rules.bookingWindowDays) return "outside_window";
  if (input.closed || !input.openingHours) return "closed";
  if (input.staff.length === 0) return "no_staff";
  return null;
}

/** Booked (blocking) minutes for a technician on the day: used to spread "Any available" work evenly. */
export function bookedMinutes(staff: CandidateStaff, now: Date): number {
  return staff.bookings
    .filter((b) => isBlocking(b, now))
    .reduce((sum, b) => sum + Math.round((b.end.getTime() - b.start.getTime()) / 60_000), 0);
}

/**
 * "Any available" choice (AGENTS.md §7): fewest booked minutes that day, then lowest sort order,
 * then id so the result is always deterministic.
 */
export function rankStaff(staff: CandidateStaff[], now: Date): CandidateStaff[] {
  const load = new Map(staff.map((s) => [s.id, bookedMinutes(s, now)]));
  return [...staff].sort(
    (a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
}

/** Whether one technician can take [start, end) on the date. */
export function isStaffFree(staff: CandidateStaff, date: DateKey, startMin: number, endMin: number, now: Date): boolean {
  if (!staff.shifts.some((shift) => covers(shift, startMin, endMin))) return false;
  const slot = { start: fromIst(date, startMin), end: fromIst(date, endMin) };
  if (staff.leave.some((l) => overlaps(l, slot))) return false;
  return !staff.bookings.some((b) => isBlocking(b, now) && overlaps(b, slot));
}

/* ---------- Main ---------- */

export function computeSlots(input: AvailabilityInput): { slots: Slot[]; closedReason: ClosedReason } {
  const { date, now, durationMin, rules, openingHours } = input;

  if (!Number.isInteger(durationMin) || durationMin <= 0) throw new RangeError(`Invalid duration: ${durationMin}`);
  if (!Number.isInteger(rules.slotIntervalMin) || rules.slotIntervalMin <= 0) {
    throw new RangeError(`Invalid slot interval: ${rules.slotIntervalMin}`);
  }

  const closedReason = dateClosedReason(input);
  if (closedReason || !openingHours) return { slots: [], closedReason };

  const ranked = rankStaff(input.staff, now);
  const earliest = new Date(now.getTime() + rules.leadTimeMin * 60_000);
  const interval = rules.slotIntervalMin;
  // Grid aligned to the clock (e.g. :00 :15 :30 :45), starting at or after opening time.
  const first = Math.ceil(openingHours.start / interval) * interval;
  const slots: Slot[] = [];

  for (let start = first; start + durationMin <= Math.min(openingHours.end, MINUTES_PER_DAY); start += interval) {
    const end = start + durationMin;
    const startsAt = fromIst(date, start);
    if (startsAt < earliest) continue;

    const staffIds = ranked.filter((s) => isStaffFree(s, date, start, end, now)).map((s) => s.id);
    if (staffIds.length > 0) slots.push({ minutes: start, startsAt, endsAt: fromIst(date, end), staffIds });
  }

  return { slots, closedReason: null };
}

/** Last bookable date for a given "now" (inclusive), for date pickers. */
export function lastBookableDate(now: Date, bookingWindowDays: number): DateKey {
  return addDays(istToday(now), bookingWindowDays - 1);
}
