import { addDays, parseDateKey, weekdayOf, type DateKey } from "@/lib/time";

/**
 * Pure month-grid rules for the calendar (components/ui/calendar.tsx). Everything works on IST
 * date keys ("2026-11-20"), never on Date objects, so the browser's own time zone can't shift a day.
 * Weeks start on Monday, as the salon reads a week.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAY_LETTERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** First day of the month containing `key`. */
export function monthOf(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`;
}

/** First day of the month `n` months after the month containing `key`. */
export function addMonths(key: DateKey, n: number): DateKey {
  const p = parseDateKey(monthOf(key));
  if (!p) return key;
  const index = p.year * 12 + (p.month - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
}

export function daysInMonth(month: DateKey): number {
  return Number(addDays(addMonths(month, 1), -1).slice(8));
}

/** Blank cells before the 1st (Monday-first) and the month's days, row by row. */
export function monthGrid(month: DateKey): { offset: number; days: DateKey[]; rows: number } {
  const first = monthOf(month);
  const offset = (weekdayOf(first) + 6) % 7;
  const count = daysInMonth(first);
  const days = Array.from({ length: count }, (_, i) => addDays(first, i));
  return { offset, days, rows: Math.ceil((offset + count) / 7) };
}

export function monthLabel(month: DateKey): { name: string; year: string } {
  const p = parseDateKey(monthOf(month));
  return p ? { name: MONTHS[p.month - 1], year: String(p.year) } : { name: "", year: "" };
}

export type DateRules = { min?: DateKey; max?: DateKey; disabled?: (day: DateKey) => boolean };

export function isSelectable(day: DateKey, rules: DateRules): boolean {
  if (rules.min && day < rules.min) return false;
  if (rules.max && day > rules.max) return false;
  return !rules.disabled?.(day);
}

/**
 * Keyboard move from `from` by `step` days, skipping blocked days (up to a year of them). Returns
 * null when nothing selectable lies that way (e.g. past maxDate), so focus stays put.
 */
export function moveDay(from: DateKey, step: number, rules: DateRules): DateKey | null {
  let day = addDays(from, step);
  const unit = Math.sign(step) || 1;
  for (let i = 0; i < 366; i++) {
    if (rules.min && day < rules.min && unit < 0) return null;
    if (rules.max && day > rules.max && unit > 0) return null;
    if (isSelectable(day, rules)) return day;
    day = addDays(day, unit);
  }
  return null;
}

/** The same day of the month `n` months away, clamped to that month's length (31 Jan + 1 → 28 Feb). */
export function shiftMonths(day: DateKey, n: number): DateKey {
  const target = addMonths(day, n);
  const d = Math.min(Number(day.slice(8)), daysInMonth(target));
  return `${target.slice(0, 8)}${String(d).padStart(2, "0")}`;
}
