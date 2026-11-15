import "server-only";
import type { StaffRole } from "@/lib/auth-schema";
import { daysBetween, fromIst, isDateKey, timeToMinutes, type DateKey } from "@/lib/time";

/** Pure admin rules, unit-tested in tests/server/admin-rules.test.ts. */

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/* ---------- Weekly shifts ---------- */

export type ShiftInput = { weekday: number; start: string; end: string };
export type Shift = { weekday: number; start: number; end: number };

export const MAX_SHIFTS_PER_DAY = 3;

/** Validates a full weekly schedule. Times are "HH:MM" (IST). Returns sorted shifts or an error message. */
export function validateShifts(input: ShiftInput[]): { shifts: Shift[] } | { error: string } {
  const shifts: Shift[] = [];
  for (const s of input) {
    if (!Number.isInteger(s.weekday) || s.weekday < 0 || s.weekday > 6) return { error: "Invalid weekday." };
    let start: number;
    let end: number;
    try {
      start = timeToMinutes(s.start);
      end = timeToMinutes(s.end);
    } catch {
      return { error: `Enter valid times for ${WEEKDAY_NAMES[s.weekday]}.` };
    }
    if (start % 5 !== 0 || end % 5 !== 0) return { error: `Use 5-minute steps for ${WEEKDAY_NAMES[s.weekday]}.` };
    if (end <= start) return { error: `On ${WEEKDAY_NAMES[s.weekday]}, the end time must be after the start time.` };
    shifts.push({ weekday: s.weekday, start, end });
  }

  shifts.sort((a, b) => a.weekday - b.weekday || a.start - b.start);
  for (let day = 0; day < 7; day++) {
    const ofDay = shifts.filter((s) => s.weekday === day);
    if (ofDay.length > MAX_SHIFTS_PER_DAY) return { error: `At most ${MAX_SHIFTS_PER_DAY} shifts on ${WEEKDAY_NAMES[day]}.` };
    for (let i = 1; i < ofDay.length; i++) {
      if (ofDay[i].start < ofDay[i - 1].end) return { error: `Shifts on ${WEEKDAY_NAMES[day]} overlap.` };
    }
  }
  return { shifts };
}

/** Bookings (IST weekday + minutes) not fully covered by any shift on their weekday. */
export function outsideShifts<T extends { weekday: number; startMin: number; endMin: number }>(bookings: T[], shifts: Shift[]): T[] {
  return bookings.filter(
    (b) => !shifts.some((s) => s.weekday === b.weekday && s.start <= b.startMin && b.endMin <= s.end),
  );
}

/* ---------- Leave ---------- */

export type LeaveInput = { startDate: string; endDate: string; startTime?: string; endTime?: string };

export const MAX_LEAVE_DAYS = 90;

/**
 * Leave as an instant range. Whole days by default (00:00 on startDate to 24:00 on endDate);
 * optional times narrow the first and last day, e.g. a 2–5 pm appointment.
 */
export function leaveRange(input: LeaveInput): { start: Date; end: Date } | { error: string } {
  if (!isDateKey(input.startDate) || !isDateKey(input.endDate)) return { error: "Enter valid dates." };
  const days = daysBetween(input.startDate, input.endDate);
  if (days < 0) return { error: "The end date must be on or after the start date." };
  if (days >= MAX_LEAVE_DAYS) return { error: `Leave can be at most ${MAX_LEAVE_DAYS} days at a time.` };

  let startMin = 0;
  let endMin = 1440;
  try {
    if (input.startTime) startMin = timeToMinutes(input.startTime);
    if (input.endTime) endMin = timeToMinutes(input.endTime);
  } catch {
    return { error: "Enter valid times." };
  }
  const start = fromIst(input.startDate as DateKey, startMin);
  const end = fromIst(input.endDate as DateKey, endMin);
  if (end <= start) return { error: "The leave must end after it starts." };
  return { start, end };
}

/* ---------- Team ---------- */

export type TeamChange = { role?: StaffRole; active?: boolean };

/**
 * Guards for editing team logins. Returns an error message, or null if allowed.
 * - You can't demote or deactivate yourself (avoids locking yourself out mid-session).
 * - There must always be at least one active owner.
 */
export function checkTeamChange(params: {
  actorId: string;
  target: { id: string; role: StaffRole; active: boolean };
  change: TeamChange;
  activeOwnerCount: number;
}): string | null {
  const { actorId, target, change, activeOwnerCount } = params;
  const demoting = change.role !== undefined && change.role !== target.role;
  const deactivating = change.active === false && target.active;

  if (target.id === actorId && (demoting || deactivating)) {
    return "You can't change your own role or deactivate yourself. Ask another owner.";
  }
  const losesOwner = target.role === "owner" && target.active && ((demoting && change.role !== "owner") || deactivating);
  if (losesOwner && activeOwnerCount <= 1) return "There must always be at least one active owner.";
  return null;
}
