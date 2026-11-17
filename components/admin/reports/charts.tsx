"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatCompactINR, formatTrendLabel } from "@/components/admin/reports/format";
import type { Bucket } from "@/lib/reports";
import { formatINR } from "@/lib/money";
import { formatMonthShort, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { HeatCell, TrendPoint } from "@/server/reports";

/**
 * Report charts (dataviz skill): thin marks rounded at the data end, a recessive grid, one y-axis,
 * hover/focus tooltips, and a table view for every chart so nothing depends on colour or a mouse.
 */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** 1-2-5 "nice" axis maximum with four gridlines. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

export function LegendKey({ color, label, soft = false }: { color: string; label: string; soft?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span
        aria-hidden
        className="size-2.5 rounded-[3px]"
        style={{ background: soft ? `color-mix(in oklab, ${color} 38%, var(--background))` : color }}
      />
      {label}
    </span>
  );
}

const HEIGHT = 220;
const PAD = { top: 12, right: 4, bottom: 26, left: 52 };

/** Revenue per day/week/month: done (solid) stacked under still-to-come (lighter step of the same hue). */
export function RevenueChart({ points, bucket }: { points: TrendPoint[]; bucket: Bucket }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const hasUpcoming = points.some((p) => p.upcomingPaise > 0);

  const ticks = useMemo(() => niceTicks(Math.max(...points.map((p) => p.revenuePaise + p.upcomingPaise), 0)), [points]);
  const max = ticks[ticks.length - 1] || 1;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = points.length ? plotW / points.length : 0;
  const barW = Math.max(2, Math.min(24, slot - 2));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  // Label every nth bar so x labels never collide (about 44px each).
  const every = Math.max(1, Math.ceil(44 / Math.max(slot, 1)));
  const point = active !== null ? points[active] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
        <LegendKey color="var(--chart-1)" label="Revenue (done)" />
        {hasUpcoming && <LegendKey color="var(--chart-1)" soft label="Still to come" />}
      </div>
      <div ref={ref} className="relative" onMouseLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label="Revenue over time. A table view follows.">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : "2 3"} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                  {formatCompactINR(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) => {
              const x = PAD.left + i * slot + (slot - barW) / 2;
              const doneTop = y(p.revenuePaise);
              const allTop = y(p.revenuePaise + p.upcomingPaise);
              const dim = active !== null && active !== i;
              return (
                <g key={p.key} opacity={dim ? 0.45 : 1} className="transition-opacity duration-150">
                  {p.revenuePaise > 0 && (
                    <path d={roundedTop(x, doneTop, barW, y(0) - doneTop, p.upcomingPaise > 0 ? 0 : 4)} fill="var(--chart-1)" />
                  )}
                  {p.upcomingPaise > 0 && (
                    // 2px surface gap between the stacked parts.
                    <path
                      d={roundedTop(x, allTop, barW, Math.max(0, doneTop - allTop - (p.revenuePaise > 0 ? 2 : 0)), 4)}
                      fill="color-mix(in oklab, var(--chart-1) 38%, var(--background))"
                    />
                  )}
                  {i % every === 0 && (
                    <text x={x + barW / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-muted text-[11px] tabular-nums">
                      {axisLabel(p.key, bucket, i)}
                    </text>
                  )}
                  {/* Hit target: the whole column slot, taller than the mark. */}
                  <rect
                    x={PAD.left + i * slot}
                    y={PAD.top}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${formatTrendLabel(p.key, bucket)}: revenue ${formatINR(p.revenuePaise)}${p.upcomingPaise ? `, still to come ${formatINR(p.upcomingPaise)}` : ""}, ${p.bookings} bookings`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    className="outline-none"
                  />
                </g>
              );
            })}
          </svg>
        )}
        {point && active !== null && (
          <div
            role="presentation"
            className="pointer-events-none absolute top-0 z-10 w-max max-w-56 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-layer)]"
            style={{
              left: Math.min(Math.max(PAD.left + active * slot + slot / 2 - 80, 0), Math.max(0, width - 170)),
            }}
          >
            <p className="mb-1 font-medium">{formatTrendLabel(point.key, bucket)}</p>
            <TooltipRow color="var(--chart-1)" label="Revenue" value={formatINR(point.revenuePaise)} />
            {point.upcomingPaise > 0 && <TooltipRow color="var(--chart-1)" soft label="Still to come" value={formatINR(point.upcomingPaise)} />}
            <p className="mt-1 text-muted tabular-nums">{point.bookings} bookings</p>
          </div>
        )}
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted hover:text-ink">Show as table</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full tabular-nums">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1 font-medium">Period</th>
                <th className="py-1 text-right font-medium">Revenue</th>
                <th className="py-1 text-right font-medium">Still to come</th>
                <th className="py-1 text-right font-medium">Bookings</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.key} className="border-t border-line">
                  <td className="py-1">{formatTrendLabel(p.key, bucket)}</td>
                  <td className="py-1 text-right">{formatINR(p.revenuePaise)}</td>
                  <td className="py-1 text-right">{formatINR(p.upcomingPaise)}</td>
                  <td className="py-1 text-right">{p.bookings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function TooltipRow({ color, label, value, soft }: { color: string; label: string; value: string; soft?: boolean }) {
  return (
    <p className="flex items-center justify-between gap-4">
      <LegendKey color={color} label={label} soft={soft} />
      <span className="font-medium tabular-nums">{value}</span>
    </p>
  );
}

/** A bar anchored at the baseline with the data end (top) rounded. */
function roundedTop(x: number, top: number, w: number, h: number, r: number): string {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${top + h} V${top + rr} Q${x},${top} ${x + rr},${top} H${x + w - rr} Q${x + w},${top} ${x + w},${top + rr} V${top + h} Z`;
}

function axisLabel(key: string, bucket: Bucket, index: number): string {
  if (bucket === "month") return formatMonthShort(key);
  const day = Number(key.slice(8));
  // Day bars show the month on the first bar and on the 1st.
  if (bucket === "day") return index === 0 || day === 1 ? `${day} ${formatMonthShort(key)}` : String(day);
  return `${day} ${formatMonthShort(key)}`;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Bookings by weekday × starting hour: one hue, light to dark (sequential). */
export function BusyHeatmap({ cells, openHours }: { cells: HeatCell[]; openHours: [number, number] }) {
  const [active, setActive] = useState<HeatCell | null>(null);
  const lookup = new Map(cells.map((c) => [`${c.weekday}:${c.hour}`, c.bookings]));
  const hours = Array.from({ length: openHours[1] - openHours[0] }, (_, i) => openHours[0] + i);
  const max = Math.max(1, ...cells.map((c) => c.bookings));
  const busiest = cells.length ? cells.reduce((a, b) => (b.bookings > a.bookings ? b : a)) : null;

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <table className="w-full min-w-[520px] border-separate border-spacing-[3px] text-[11px]" onMouseLeave={() => setActive(null)}>
          <caption className="sr-only">Bookings by weekday and starting hour</caption>
          <thead>
            <tr>
              <th />
              {hours.map((h) => (
                <th key={h} scope="col" className="font-normal text-muted tabular-nums">
                  {formatHour(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((label, i) => (
              <tr key={label}>
                <th scope="row" className="pr-1 text-left font-normal text-muted">
                  {label}
                </th>
                {hours.map((h) => {
                  const count = lookup.get(`${i + 1}:${h}`) ?? 0;
                  const share = count / max;
                  return (
                    <td
                      key={h}
                      tabIndex={0}
                      onMouseEnter={() => setActive({ weekday: i + 1, hour: h, bookings: count })}
                      onFocus={() => setActive({ weekday: i + 1, hour: h, bookings: count })}
                      className={cn(
                        "h-7 rounded-[4px] text-center tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ink",
                        share > 0.55 ? "text-white" : "text-transparent",
                      )}
                      style={{
                        background: count ? `color-mix(in oklab, var(--chart-1) ${Math.round(12 + share * 88)}%, var(--background))` : "var(--hover)",
                      }}
                    >
                      {count}
                      <span className="sr-only">
                        {" "}
                        bookings on {label} at {formatHour(h)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <p aria-live="polite" className="tabular-nums">
          {active
            ? `${WEEKDAYS[active.weekday - 1]} ${formatHour(active.hour)}: ${active.bookings} booking${active.bookings === 1 ? "" : "s"}`
            : busiest
              ? `Busiest: ${WEEKDAYS[busiest.weekday - 1]} ${formatHour(busiest.hour)} (${busiest.bookings} bookings)`
              : "No bookings yet"}
        </p>
        <span className="inline-flex items-center gap-1.5">
          Fewer
          {[0.12, 0.4, 0.7, 1].map((s) => (
            <span key={s} aria-hidden className="size-3 rounded-[3px]" style={{ background: `color-mix(in oklab, var(--chart-1) ${s * 100}%, var(--background))` }} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}

function formatHour(hour: number): string {
  return formatTime(hour * 60).replace(":00", "");
}
