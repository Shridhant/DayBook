import type { Bucket, DateRange } from "@/lib/reports";
import { formatMonthShort, parseDateKey, type DateKey } from "@/lib/time";

/** Display helpers for the reports page (plain module: used by server and client components). */

const compactINR = new Intl.NumberFormat("en-IN", { notation: "compact", style: "currency", currency: "INR", maximumFractionDigits: 1 });

/** Axis labels: 2500000 paise → "₹25K", 125000000 → "₹12.5L". */
export function formatCompactINR(paise: number): string {
  return compactINR.format(paise / 100);
}

/** 0.234 → "23%", 0.0412 → "4.1%"; null → "–". */
export function formatPercent(value: number | null): string {
  if (value === null) return "–";
  const pct = value * 100;
  return `${pct > 0 && pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}

function dayMonth(key: DateKey): string {
  return `${Number(key.slice(8))} ${formatMonthShort(key)}`;
}

/** "1 – 30 Nov 2026", "28 Oct – 3 Nov 2026", "15 Dec 2025 – 14 Jan 2026". */
export function formatRangeLabel({ from, to }: DateRange): string {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  if (!a || !b) return `${from} – ${to}`;
  if (from === to) return `${dayMonth(from)} ${b.year}`;
  if (a.year !== b.year) return `${dayMonth(from)} ${a.year} – ${dayMonth(to)} ${b.year}`;
  if (a.month === b.month) return `${a.day} – ${dayMonth(to)} ${b.year}`;
  return `${dayMonth(from)} – ${dayMonth(to)} ${b.year}`;
}

/** Tooltip/table label for a trend bucket. */
export function formatTrendLabel(key: DateKey, bucket: Bucket): string {
  const p = parseDateKey(key);
  if (!p) return key;
  if (bucket === "month") return `${formatMonthShort(key)} ${p.year}`;
  if (bucket === "week") return `Week of ${dayMonth(key)}`;
  return `${dayMonth(key)} ${p.year}`;
}
