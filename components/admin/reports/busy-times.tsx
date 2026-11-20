"use client";

import { motion, useReducedMotion } from "motion/react";
import { Maximize2 } from "lucide-react";
import { useState } from "react";
import { tint, useWidth } from "@/components/admin/reports/charts";
import { Sheet, SheetContent } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { HeatCell } from "@/server/reports";

/**
 * Busiest times (bookings by weekday × starting hour). The card shows a dot grid; tapping it
 * opens a panel where the same grid can rise into a 3D skyline, each column as tall as the slot is
 * busy. One hue, light to dark; every value is also readable as text.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatHour(hour: number): string {
  return formatTime(hour * 60).replace(":00", "");
}

function cellColor(count: number, max: number): string {
  return count ? tint("var(--chart-1)", Math.round(14 + (count / max) * 86)) : "var(--hover)";
}

type Grid = { hours: number[]; count: (weekday: number, hour: number) => number; max: number; busiest: HeatCell | null };

function useGrid(cells: HeatCell[], openHours: [number, number]): Grid {
  const lookup = new Map(cells.map((c) => [`${c.weekday}:${c.hour}`, c.bookings]));
  const hours = Array.from({ length: Math.max(1, openHours[1] - openHours[0]) }, (_, i) => openHours[0] + i);
  const max = Math.max(1, ...cells.map((c) => c.bookings));
  const busiest = cells.length ? cells.reduce((a, b) => (b.bookings > a.bookings ? b : a)) : null;
  return { hours, count: (w, h) => lookup.get(`${w}:${h}`) ?? 0, max, busiest };
}

function describe(cell: HeatCell | null, fallback: string): string {
  if (!cell) return fallback;
  return `${WEEKDAYS[cell.weekday - 1]} ${formatHour(cell.hour)}: ${cell.bookings} booking${cell.bookings === 1 ? "" : "s"}`;
}

export function BusyTimes({ cells, openHours }: { cells: HeatCell[]; openHours: [number, number] }) {
  const grid = useGrid(cells, openHours);
  const [hover, setHover] = useState<HeatCell | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onMouseLeave={() => setHover(null)}
        aria-label="Open busiest times in detail"
        className="group block w-full cursor-zoom-in rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `24px repeat(${grid.hours.length}, minmax(0, 1fr))` }}>
          {WEEKDAYS.map((label, wi) => (
            <Row key={label} label={label}>
              {grid.hours.map((h) => {
                const count = grid.count(wi + 1, h);
                return (
                  <span
                    key={h}
                    aria-hidden
                    onMouseEnter={() => setHover({ weekday: wi + 1, hour: h, bookings: count })}
                    className="flex aspect-square items-center justify-center"
                  >
                    <span
                      className="block size-[78%] rounded-full transition-transform duration-150 ease-out hover:scale-125 motion-reduce:transition-none"
                      style={{ background: cellColor(count, grid.max) }}
                    />
                  </span>
                );
              })}
            </Row>
          ))}
          <span />
          {grid.hours.map((h, i) => (
            <span key={h} className="text-center text-[9px] text-muted tabular-nums">
              {i % 2 === 0 ? formatHour(h) : ""}
            </span>
          ))}
        </div>
      </button>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <p aria-live="polite" className="tabular-nums">
          {hover ? describe(hover, "") : grid.busiest ? `Busiest: ${describe(grid.busiest, "")}` : "No bookings yet"}
        </p>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-hover hover:text-ink">
          <Maximize2 className="size-3" aria-hidden />
          Explore
        </button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title="Busiest times" className="w-[min(680px,100vw)]">
          <BusyDetail cells={cells} grid={grid} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="flex items-center text-[10px] text-muted">{label}</span>
      {children}
    </>
  );
}

/* ---------- Slide-over: flat grid ↔ 3D skyline ---------- */

type View = "flat" | "skyline";

function BusyDetail({ cells, grid }: { cells: HeatCell[]; grid: Grid }) {
  const [view, setView] = useState<View>("skyline");
  const [active, setActive] = useState<HeatCell | null>(null);
  const top = [...cells].sort((a, b) => b.bookings - a.bookings).slice(0, 5);
  const total = cells.reduce((t, c) => t + c.bookings, 0);

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-muted">
        Bookings by day and starting hour, for the period and filters on the page. Plan shifts and offers around the quiet slots.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs<View>
          label="Chart view"
          value={view}
          onValueChange={setView}
          items={[
            { value: "flat", label: "Flat" },
            { value: "skyline", label: "3D" },
          ]}
        />
        <p aria-live="polite" className="text-xs text-muted tabular-nums">
          {describe(active, grid.busiest ? `Busiest: ${describe(grid.busiest, "")}` : "No bookings yet")}
        </p>
      </div>

      <Skyline grid={grid} three={view === "skyline"} active={active} onActive={setActive} />

      <div className="flex items-center justify-end gap-1.5 text-xs text-muted">
        Fewer
        {[0, 0.33, 0.66, 1].map((s) => (
          <span key={s} aria-hidden className="size-3 rounded-[3px]" style={{ background: tint("var(--chart-1)", Math.round(14 + s * 86)) }} />
        ))}
        More
      </div>

      {top.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-muted">Busiest slots</h3>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {top.map((c, i) => (
              <li key={`${c.weekday}:${c.hour}`} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <span className="w-4 text-xs text-muted tabular-nums">{i + 1}</span>
                <span className="flex-1">
                  {WEEKDAYS[c.weekday - 1]}, {formatHour(c.hour)} – {formatHour(c.hour + 1)}
                </span>
                <span className="tabular-nums">{c.bookings}</span>
                <span className="w-10 text-right text-xs text-muted tabular-nums">{total ? Math.round((c.bookings / total) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-muted hover:text-ink">Show as table</summary>
        <div className="thin-scroll mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] tabular-nums">
            <thead className="text-muted">
              <tr>
                <th />
                {grid.hours.map((h) => (
                  <th key={h} scope="col" className="py-1 font-normal">
                    {formatHour(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((label, wi) => (
                <tr key={label} className="border-t border-line">
                  <th scope="row" className="py-1 pr-2 text-left font-normal text-muted">
                    {label}
                  </th>
                  {grid.hours.map((h) => (
                    <td key={h} className="py-1 text-center">
                      {grid.count(wi + 1, h) || "·"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/**
 * The grid as CSS 3D boxes. Each cell is a box with a top face lifted by --h and two visible
 * sides (south and west, the ones facing the viewer after the -42° turn). Switching views animates
 * the tilt and --h together, so the flat grid rises into the skyline and settles back.
 */
function Skyline({
  grid,
  three,
  active,
  onActive,
}: {
  grid: Grid;
  three: boolean;
  active: HeatCell | null;
  onActive: (cell: HeatCell | null) => void;
}) {
  const reduce = useReducedMotion();
  const [ref, width] = useWidth<HTMLDivElement>();
  const cols = grid.hours.length;
  const gap = 4;
  const cell = Math.max(14, Math.min(34, Math.floor(((width || 600) * 0.7) / (cols + 1)) - gap));
  const tallest = cell * 4.5;
  const gridW = 26 + cols * (cell + gap);
  const gridH = 16 + 7 * (cell + gap);
  const ease = [0.32, 0.72, 0, 1] as const;

  return (
    <div
      ref={ref}
      className="relative flex items-center justify-center overflow-hidden rounded-xl border border-line bg-canvas"
      style={{ height: three ? gridH + tallest * 0.55 + 40 : gridH + 40, perspective: 1400, transition: reduce ? undefined : "height 400ms cubic-bezier(0.32,0.72,0,1)" }}
      onMouseLeave={() => onActive(null)}
    >
      <motion.div
        role="img"
        aria-label="Bookings by weekday and hour. The table below lists every value."
        className="grid shrink-0"
        style={{
          width: gridW,
          height: gridH,
          gap,
          gridTemplateColumns: `22px repeat(${cols}, ${cell}px)`,
          gridTemplateRows: `12px repeat(7, ${cell}px)`,
          transformStyle: "preserve-3d",
        }}
        initial={false}
        animate={three ? { rotateX: 56, rotateZ: -42, scale: 0.92, y: tallest * 0.22 } : { rotateX: 0, rotateZ: 0, scale: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.45, ease }}
      >
        <span />
        {grid.hours.map((h, i) => (
          <span key={h} className="text-center text-[9px] leading-3 text-muted tabular-nums">
            {i % 2 === 0 ? formatHour(h) : ""}
          </span>
        ))}
        {WEEKDAYS.map((label, wi) => (
          <Row key={label} label={label}>
            {grid.hours.map((h, hi) => {
              const count = grid.count(wi + 1, h);
              const on = active?.weekday === wi + 1 && active.hour === h;
              const base = on ? "var(--brand)" : cellColor(count, grid.max);
              const height = three && count ? Math.max(3, (count / grid.max) * tallest) : 0;
              return (
                <motion.div
                  key={h}
                  aria-hidden
                  className="relative"
                  style={{ transformStyle: "preserve-3d", ["--h" as string]: "0px" }}
                  initial={false}
                  animate={{ ["--h" as string]: `${height}px` }}
                  transition={reduce ? { duration: 0 } : { duration: 0.5, ease, delay: three ? 0.12 + (wi + hi) * 0.012 : 0 }}
                  onPointerEnter={() => onActive({ weekday: wi + 1, hour: h, bookings: count })}
                >
                  {/* South face: hinged on the bottom edge, stands up by --h. */}
                  <span
                    className="absolute inset-x-0 bottom-0 origin-bottom"
                    style={{ height: "var(--h)", transform: "rotateX(-90deg)", background: `color-mix(in oklab, ${base}, black 16%)` }}
                  />
                  {/* West face: hinged on the left edge. */}
                  <span
                    className="absolute inset-y-0 left-0 origin-left"
                    style={{ width: "var(--h)", transform: "rotateY(-90deg)", background: `color-mix(in oklab, ${base}, black 30%)` }}
                  />
                  <span
                    className={cn("absolute inset-0 rounded-[3px]", on && "ring-2 ring-ink/70")}
                    style={{ transform: "translateZ(var(--h))", background: base }}
                  />
                </motion.div>
              );
            })}
          </Row>
        ))}
      </motion.div>
    </div>
  );
}
