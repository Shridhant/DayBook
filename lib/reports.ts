import { addDays, daysBetween, isDateKey, parseDateKey, type DateKey } from "@/lib/time";

/**
 * Pure rules for the owner's reports (date ranges, comparison periods, chart buckets), shared by
 * the server queries and the filter bar. All dates are IST calendar days, `to` inclusive.
 */

export type DateRange = { from: DateKey; to: DateKey };
export type Bucket = "day" | "week" | "month";
export type ReportSource = "online" | "walk_in" | "phone";

export const REPORT_SOURCES: ReportSource[] = ["online", "walk_in", "phone"];
export const SOURCE_LABEL: Record<ReportSource, string> = { online: "Online", walk_in: "Walk-in", phone: "Phone" };

export const REPORT_PRESETS = ["this_month", "last_month", "last_7", "last_30", "last_90", "this_year", "next_14", "custom"] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];
export const PRESET_LABEL: Record<ReportPreset, string> = {
  this_month: "This month",
  last_month: "Last month",
  last_7: "Last 7 days",
  last_30: "Last 30 days",
  last_90: "Last 90 days",
  this_year: "This year",
  next_14: "Next 14 days",
  custom: "Custom dates",
};

/** Longest range a report covers, so one request can't scan years of bookings. */
export const MAX_RANGE_DAYS = 731;

function monthStart(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`;
}

function monthEnd(key: DateKey): DateKey {
  const { year, month } = parseDateKey(key) ?? { year: 1970, month: 1 };
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return addDays(next, -1);
}

export function presetRange(preset: Exclude<ReportPreset, "custom">, today: DateKey): DateRange {
  switch (preset) {
    case "this_month":
      return { from: monthStart(today), to: monthEnd(today) };
    case "last_month": {
      const end = addDays(monthStart(today), -1);
      return { from: monthStart(end), to: end };
    }
    case "last_7":
      return { from: addDays(today, -6), to: today };
    case "last_30":
      return { from: addDays(today, -29), to: today };
    case "last_90":
      return { from: addDays(today, -89), to: today };
    case "this_year":
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case "next_14":
      return { from: today, to: addDays(today, 13) };
  }
}

/**
 * The range a request asks for: a preset, or valid custom dates (swapped if reversed, capped at
 * MAX_RANGE_DAYS). Anything else falls back to this month.
 */
export function resolveRange(
  input: { preset?: string; from?: string; to?: string },
  today: DateKey,
): { preset: ReportPreset; range: DateRange } {
  const preset = REPORT_PRESETS.includes(input.preset as ReportPreset) ? (input.preset as ReportPreset) : undefined;
  if (preset && preset !== "custom") return { preset, range: presetRange(preset, today) };
  if (isDateKey(input.from) && isDateKey(input.to)) {
    const [first, to] = input.from <= input.to ? [input.from, input.to] : [input.to, input.from];
    const from = daysBetween(first, to) >= MAX_RANGE_DAYS ? addDays(to, -(MAX_RANGE_DAYS - 1)) : first;
    return { preset: "custom", range: { from, to } };
  }
  return { preset: "this_month", range: presetRange("this_month", today) };
}

export function rangeDays({ from, to }: DateRange): number {
  return daysBetween(from, to) + 1;
}

/**
 * The period to compare against: the previous calendar month for a whole month, otherwise the
 * same number of days just before.
 */
export function previousRange(range: DateRange): DateRange {
  if (range.from === monthStart(range.from) && range.to === monthEnd(range.from)) {
    const end = addDays(range.from, -1);
    return { from: monthStart(end), to: end };
  }
  const days = rangeDays(range);
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) };
}

/**
 * The windows the KPI deltas compare. A period still in progress compares only its days so far
 * with the same number of days at the start of the previous period ("1–18 Nov vs 1–18 Oct"), so
 * half a month never looks like a 50% drop. A period entirely in the future has no comparison.
 */
export function comparisonRanges(range: DateRange, today: DateKey): { current: DateRange; previous: DateRange } | null {
  if (range.from > today) return null;
  const previous = previousRange(range);
  if (range.to <= today) return { current: { from: range.from, to: range.to }, previous };
  const elapsed = daysBetween(range.from, today);
  return {
    current: { from: range.from, to: today },
    previous: { from: previous.from, to: addDays(previous.from, Math.min(elapsed, rangeDays(previous) - 1)) },
  };
}

/** Bars per day up to a month, per week up to ~4 months, then per month. */
export function pickBucket(range: DateRange): Bucket {
  const days = rangeDays(range);
  if (days <= 35) return "day";
  if (days <= 126) return "week";
  return "month";
}

/** Start date of the bucket containing `date` (weeks start on Monday, like Postgres date_trunc). */
export function bucketStart(date: DateKey, bucket: Bucket): DateKey {
  if (bucket === "day") return date;
  if (bucket === "month") return monthStart(date);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

/** Every bucket start from the range's first to its last, so empty periods still get a bar. */
export function bucketKeys(range: DateRange, bucket: Bucket): DateKey[] {
  const keys: DateKey[] = [];
  let key = bucketStart(range.from, bucket);
  while (key <= range.to) {
    keys.push(key);
    key = bucket === "day" ? addDays(key, 1) : bucket === "week" ? addDays(key, 7) : addDays(monthEnd(key), 1);
  }
  return keys;
}

/** Change from `previous` to `current` as a fraction (0.12 = +12%), or null when there's no base. */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

/** `part / whole`, or null when the whole is 0 (shown as "–", never as 0%). */
export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}
