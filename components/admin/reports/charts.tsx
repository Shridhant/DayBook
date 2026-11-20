"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatCompactINR, formatPercent, formatTrendLabel } from "@/components/admin/reports/format";
import { Avatar } from "@/components/ui/avatar";
import type { Bucket } from "@/lib/reports";
import { formatINR } from "@/lib/money";
import { formatDuration, formatMonthShort } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { TrendPoint } from "@/server/reports";

/**
 * Report charts (dataviz skill): one accent hue, a recessive grid, hover/focus tooltips, and a
 * table view or printed values for every chart so nothing depends on colour or a mouse.
 */

export function useWidth<T extends HTMLElement>() {
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

/** 1-2-5 "nice" axis maximum with about four gridlines. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

/** A soft step of a colour for fills and light cells. */
export const tint = (color: string, pct: number) => `color-mix(in oklab, ${color} ${pct}%, var(--background))`;

export function LegendKey({ color, label, soft = false }: { color: string; label: string; soft?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: soft ? tint(color, 38) : color }} />
      {label}
    </span>
  );
}

/** Legend sample for a line series: solid, dashed or dotted. */
function LineKey({ label, dash, color }: { label: string; dash?: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <svg aria-hidden width="16" height="6" className="overflow-visible">
        <line x1="0" x2="16" y1="3" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dash} strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}

/**
 * A smooth line through the points. Control points are clamped between neighbours so the curve
 * never overshoots (no fake dips below zero between two busy days).
 */
function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const lo = Math.min(p1[1], p2[1]);
    const hi = Math.max(p1[1], p2[1]);
    const clamp = (v: number) => Math.min(hi, Math.max(lo, v));
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, clamp(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, clamp(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/* ---------- Sparkline ---------- */

/** Tiny trend line for a KPI card: area fill, emphasised last point. Decorative; the card prints the value. */
export function Sparkline({ values, height = 40 }: { values: number[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const max = Math.max(...values, 0);
  const pts: [number, number][] = values.map((v, i) => [
    values.length === 1 ? width / 2 : (i / (values.length - 1)) * (width - 4) + 2,
    max > 0 ? height - 3 - (v / max) * (height - 8) : height - 3,
  ]);
  const line = smoothPath(pts);
  const last = pts[pts.length - 1];
  return (
    <div ref={ref} aria-hidden className="h-10 w-full">
      {width > 0 && values.length > 0 && (
        <svg width={width} height={height}>
          <path d={`${line} L${last[0]},${height} L${pts[0][0]},${height} Z`} fill={tint("var(--chart-1)", 12)} />
          <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={last[0]} cy={last[1]} r="2.75" fill="var(--chart-1)" stroke="var(--background)" strokeWidth="1.5" />
        </svg>
      )}
    </div>
  );
}

/* ---------- Revenue line chart ---------- */

const HEIGHT = 240;
const PAD = { top: 16, right: 12, bottom: 26, left: 52 };

/**
 * Revenue per bucket as a line: solid up to today, dashed for bookings still to come, and the
 * previous period dotted behind it. Hover or arrow keys move a tooltip card along the line.
 */
export function RevenueChart({
  points,
  previous,
  bucket,
  today,
}: {
  points: TrendPoint[];
  previous: TrendPoint[] | null;
  bucket: Bucket;
  today: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const values = points.map((p) => p.revenuePaise + p.upcomingPaise);
  const prev = previous ? previous.slice(0, points.length).map((p) => p.revenuePaise + p.upcomingPaise) : null;
  const ticks = useMemo(() => niceTicks(Math.max(0, ...values, ...(prev ?? []))), [values, prev]);
  const max = ticks[ticks.length - 1] || 1;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const n = points.length;
  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  // The bucket holding today is the last solid point; later ones are bookings still to come.
  let lastPast = -1;
  points.forEach((p, i) => {
    if (p.key <= today) lastPast = i;
  });
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const solid = lastPast >= 0 ? pts.slice(0, lastPast + 1) : [];
  const future = lastPast >= 0 ? pts.slice(lastPast) : pts;
  const prevPts = prev?.map((v, i) => [x(i), y(v)] as [number, number]) ?? [];
  const hasFuture = future.length > 1 || lastPast < 0;
  const every = Math.max(1, Math.ceil(52 / Math.max(plotW / Math.max(n, 1), 1)));

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - PAD.left;
    const i = n <= 1 ? 0 : Math.round((px / plotW) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActive((a) => Math.min(n - 1, Math.max(0, (a ?? (e.key === "ArrowLeft" ? n : -1)) + (e.key === "ArrowLeft" ? -1 : 1))));
  }

  const point = active !== null ? points[active] : null;
  const TIP_W = 188;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
        <LineKey color="var(--chart-1)" label="Revenue" />
        {hasFuture && <LineKey color="var(--chart-1)" dash="4 4" label="Still to come" />}
        {prev && <LineKey color="var(--text-muted)" dash="0.1 4" label="Previous period" />}
      </div>
      <div
        ref={ref}
        className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        tabIndex={0}
        role="group"
        aria-label="Revenue over time. Use the arrow keys to read each period. A table view follows."
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        {width > 0 && (
          <svg width={width} height={HEIGHT} onPointerMove={onPointerMove} onPointerLeave={() => setActive(null)} aria-hidden className="touch-pan-y">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : "2 4"} />
                <text x={PAD.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                  {formatCompactINR(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) =>
              i % every === 0 ? (
                <text key={p.key} x={x(i)} y={HEIGHT - 6} textAnchor="middle" className="fill-muted text-[11px] tabular-nums">
                  {axisLabel(p.key, bucket, i)}
                </text>
              ) : null,
            )}
            {prevPts.length > 1 && (
              <path d={smoothPath(prevPts)} fill="none" stroke="var(--text-muted)" strokeOpacity="0.7" strokeWidth="1.75" strokeDasharray="0.1 5" strokeLinecap="round" />
            )}
            {solid.length > 1 && (
              <>
                <path d={`${smoothPath(solid)} L${solid[solid.length - 1][0]},${y(0)} L${solid[0][0]},${y(0)} Z`} fill={tint("var(--chart-1)", 10)} />
                <path d={smoothPath(solid)} fill="none" stroke="var(--chart-1)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}
            {hasFuture && future.length > 1 && (
              <path d={smoothPath(future)} fill="none" stroke="var(--chart-1)" strokeOpacity="0.75" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
            )}
            {n === 1 && <circle cx={pts[0][0]} cy={pts[0][1]} r="4" fill="var(--chart-1)" />}
            {active !== null && (
              <g>
                <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={y(0)} stroke="var(--border)" />
                {prev && prev[active] !== undefined && <circle cx={x(active)} cy={y(prev[active])} r="3" fill="var(--background)" stroke="var(--text-muted)" strokeWidth="1.5" />}
                <circle cx={x(active)} cy={y(values[active])} r="4.5" fill="var(--chart-1)" stroke="var(--background)" strokeWidth="2" />
              </g>
            )}
          </svg>
        )}
        {point && active !== null && (
          <div
            role="presentation"
            className="pointer-events-none absolute z-10 rounded-xl border border-line bg-[var(--menu)] px-3 py-2.5 text-xs shadow-[var(--shadow-layer)] backdrop-blur-md transition-[left,top] duration-150 ease-out motion-reduce:transition-none"
            style={{
              width: TIP_W,
              left: Math.min(Math.max(x(active) - TIP_W / 2, 0), Math.max(0, width - TIP_W)),
              top: Math.max(0, y(values[active]) - 108),
            }}
          >
            <p className="mb-1.5 font-medium">{formatTrendLabel(point.key, bucket)}</p>
            <TooltipRow color="var(--chart-1)" label="Done" value={formatINR(point.revenuePaise)} />
            {point.upcomingPaise > 0 && <TooltipRow color="var(--chart-1)" soft label="Still to come" value={formatINR(point.upcomingPaise)} />}
            {prev && prev[active] !== undefined && <TooltipRow color="var(--text-muted)" soft label="Previous" value={formatINR(prev[active])} />}
            <p className="mt-1 text-muted tabular-nums">
              {point.bookings} booking{point.bookings === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted hover:text-ink">Show as table</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full tabular-nums">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1 font-medium">Period</th>
                <th className="py-1 text-right font-medium">Revenue</th>
                <th className="py-1 text-right font-medium">Still to come</th>
                {prev && <th className="py-1 text-right font-medium">Previous</th>}
                <th className="py-1 text-right font-medium">Bookings</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={p.key} className="border-t border-line">
                  <td className="py-1">{formatTrendLabel(p.key, bucket)}</td>
                  <td className="py-1 text-right">{formatINR(p.revenuePaise)}</td>
                  <td className="py-1 text-right">{formatINR(p.upcomingPaise)}</td>
                  {prev && <td className="py-1 text-right">{prev[i] !== undefined ? formatINR(prev[i]) : "–"}</td>}
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
    <p className="flex items-center justify-between gap-4 py-px">
      <LegendKey color={color} label={label} soft={soft} />
      <span className="font-medium tabular-nums">{value}</span>
    </p>
  );
}

function axisLabel(key: string, bucket: Bucket, index: number): string {
  if (bucket === "month") return formatMonthShort(key);
  const day = Number(key.slice(8));
  if (bucket === "day") return index === 0 || day === 1 ? `${day} ${formatMonthShort(key)}` : String(day);
  return `${day} ${formatMonthShort(key)}`;
}

/* ---------- Artist utilisation bars ---------- */

export type ArtistBar = { id: string; name: string; photoPath: string | null; utilisation: number | null; bookedMinutes: number; bookings: number };

/**
 * One column per artist: booked time as a share of shift time. The busiest artist is the full
 * accent; the dashed line is the salon average. Hover or focus a column to read it.
 */
export function ArtistBars({ artists, average }: { artists: ArtistBar[]; average: number | null }) {
  const [active, setActive] = useState<string | null>(null);
  const top = artists.reduce<ArtistBar | null>((a, b) => ((b.utilisation ?? -1) > (a?.utilisation ?? -1) ? b : a), null);
  const shown = artists.find((a) => a.id === active) ?? top;
  const max = Math.max(1, ...artists.map((a) => a.utilisation ?? 0));
  const H = 148;

  if (artists.length === 0) return <p className="text-[13px] text-muted">No artists.</p>;
  return (
    <div>
      <div className="mb-3 flex min-h-9 items-center gap-2.5" aria-live="polite">
        {shown && (
          <>
            <Avatar name={shown.name} src={shown.photoPath} size="sm" />
            <div className="min-w-0 text-xs">
              <p className="truncate font-medium text-ink">
                {shown.name}
                {shown.id === top?.id && !active && <span className="ml-1.5 font-normal text-muted">busiest</span>}
              </p>
              <p className="text-muted tabular-nums">
                {formatPercent(shown.utilisation)} · {formatDuration(shown.bookedMinutes)} booked · {shown.bookings} bookings
              </p>
            </div>
          </>
        )}
      </div>
      <div className="thin-scroll overflow-x-auto pb-1">
        <div className="relative" style={{ minWidth: artists.length * 30 }} onMouseLeave={() => setActive(null)}>
          <div className="relative flex items-end gap-1.5 border-b border-line" style={{ height: H }}>
            {average !== null && (
              <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-ink/40" style={{ bottom: (average / max) * H }}>
                <span className="absolute -top-4 right-0 rounded bg-surface px-1 text-[10px] text-muted tabular-nums">avg {formatPercent(average)}</span>
              </div>
            )}
            {artists.map((a) => {
              const h = a.utilisation ? Math.max(3, (a.utilisation / max) * H) : 0;
              const isTop = a.id === top?.id;
              const on = active === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  aria-label={`${a.name}: ${formatPercent(a.utilisation)} utilisation`}
                  onMouseEnter={() => setActive(a.id)}
                  onFocus={() => setActive(a.id)}
                  onBlur={() => setActive(null)}
                >
                  <span
                    className={cn("block w-full max-w-7 rounded-t-[5px] transition-[background-color,height] duration-200 motion-reduce:transition-none")}
                    style={{ height: h, background: isTop || on ? "var(--chart-1)" : tint("var(--chart-1)", 30) }}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {artists.map((a) => (
              <span key={a.id} className={cn("min-w-0 flex-1 truncate text-center text-[10px]", active === a.id ? "text-ink" : "text-muted")}>
                {a.name.split(" ")[0]}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
