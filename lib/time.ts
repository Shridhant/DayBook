/**
 * Salon time helpers (AGENTS.md §7 "Time").
 *
 * The salon runs on India Standard Time. India has had no daylight saving since 1945, so IST is a
 * fixed UTC+05:30 and we convert with plain arithmetic instead of relying on the machine's timezone
 * (the VPS, the browser and CI may all be in different zones).
 *
 * Vocabulary:
 * - instant:   a real moment, a JS `Date` (stored in Postgres as timestamptz).
 * - DateKey:   an IST calendar date as "YYYY-MM-DD".
 * - minutes:   wall-clock minutes since IST midnight, 0–1440 (e.g. 16:30 → 990).
 *
 * Formatting is done by hand (not Intl) so server and browser always produce identical strings,
 * which avoids hydration mismatches.
 */

export const SALON_TIME_ZONE = "Asia/Kolkata";
export const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60_000;
const DAY_MS = 86_400_000;
export const MINUTES_PER_DAY = 1440;

export type DateKey = string;
/** 0 = Sunday … 6 = Saturday (same as Postgres `weekday` columns and `Date#getUTCDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const pad2 = (n: number) => String(n).padStart(2, "0");

/* ---------- DateKey ---------- */

/** Parses a "YYYY-MM-DD" key, rejecting malformed or impossible dates (e.g. 2026-02-30). */
export function parseDateKey(key: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function isDateKey(value: unknown): value is DateKey {
  return typeof value === "string" && parseDateKey(value) !== null;
}

function mustParse(key: DateKey) {
  const parts = parseDateKey(key);
  if (!parts) throw new RangeError(`Invalid date key: ${key}`);
  return parts;
}

/** Midnight UTC of the calendar date: used only for calendar arithmetic, never as an instant. */
function calendarMs(key: DateKey) {
  const { year, month, day } = mustParse(key);
  return Date.UTC(year, month - 1, day);
}

function keyFromCalendarMs(ms: number): DateKey {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function addDays(key: DateKey, days: number): DateKey {
  return keyFromCalendarMs(calendarMs(key) + days * DAY_MS);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((calendarMs(to) - calendarMs(from)) / DAY_MS);
}

export function weekdayOf(key: DateKey): Weekday {
  return new Date(calendarMs(key)).getUTCDay() as Weekday;
}

/* ---------- Instants ↔ IST ---------- */

/** The IST calendar date, minutes-since-midnight and weekday of an instant. */
export function toIst(instant: Date): { date: DateKey; minutes: number; weekday: Weekday } {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MS);
  return {
    date: `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`,
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay() as Weekday,
  };
}

/** The instant for an IST wall-clock time. `minutes` may be 1440 (the following midnight). */
export function fromIst(date: DateKey, minutes: number): Date {
  return new Date(calendarMs(date) + minutes * 60_000 - IST_OFFSET_MS);
}

/** Today's IST date. Never render this in server markup the client re-renders (hydration). */
export function istToday(now: Date = new Date()): DateKey {
  return toIst(now).date;
}

/** [start, end) instants of an IST calendar day, for querying a day's bookings. */
export function istDayRange(date: DateKey): { start: Date; end: Date } {
  return { start: fromIst(date, 0), end: fromIst(date, MINUTES_PER_DAY) };
}

/* ---------- Wall-clock minutes ---------- */

/** "HH:MM" or Postgres "HH:MM:SS" → minutes since midnight. "24:00" is allowed as end of day. */
export function timeToMinutes(time: string): number {
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!m) throw new RangeError(`Invalid time: ${time}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  const total = h * 60 + min;
  if (min > 59 || total > MINUTES_PER_DAY || (m[3] !== undefined && Number(m[3]) !== 0)) {
    throw new RangeError(`Invalid time: ${time}`);
  }
  return total;
}

/** Minutes since midnight → "HH:MM" (24-hour, for storage and form values). */
export function minutesToTime(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > MINUTES_PER_DAY) {
    throw new RangeError(`Invalid minutes: ${minutes}`);
  }
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

/* ---------- Display formatting (AGENTS.md §10) ---------- */

/** 990 → "4:30 pm", 720 → "12:00 pm", 0 → "12:00 am". */
export function formatTime(minutes: number): string {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad2(m % 60)} ${h24 < 12 ? "am" : "pm"}`;
}

/** An instant as IST clock time, e.g. "4:30 pm". */
export function formatInstantTime(instant: Date): string {
  return formatTime(toIst(instant).minutes);
}

/** "2026-11-15" → "Sun, 15 Nov" (or "Sun, 15 Nov 2026" with `year`). */
export function formatDate(date: DateKey, opts: { year?: boolean } = {}): string {
  const { year, month, day } = mustParse(date);
  const base = `${WEEKDAYS_SHORT[weekdayOf(date)]}, ${day} ${MONTHS_SHORT[month - 1]}`;
  return opts.year ? `${base} ${year}` : base;
}

export function formatWeekdayShort(date: DateKey): string {
  return WEEKDAYS_SHORT[weekdayOf(date)];
}

export function formatMonthShort(date: DateKey): string {
  return MONTHS_SHORT[mustParse(date).month - 1];
}

/** 90 → "1h 30m", 60 → "1h", 45 → "45m". */
export function formatDuration(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0) throw new RangeError(`Invalid duration: ${minutes}`);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * A leave range for display. Whole days read as dates ("Sat, 21 Nov – Mon, 23 Nov"; the end is
 * exclusive midnight), part days include times ("Sat, 21 Nov, 2:00 pm – 5:00 pm").
 */
export function formatLeaveRange(start: Date, end: Date): string {
  const s = toIst(start);
  const e = toIst(end);
  if (s.minutes === 0 && e.minutes === 0) {
    const lastDay = addDays(e.date, -1);
    return lastDay === s.date ? formatDate(s.date) : `${formatDate(s.date)} – ${formatDate(lastDay)}`;
  }
  const from = `${formatDate(s.date)}, ${formatTime(s.minutes)}`;
  return s.date === e.date ? `${from} – ${formatTime(e.minutes)}` : `${from} – ${formatDate(e.date)}, ${formatTime(e.minutes)}`;
}
