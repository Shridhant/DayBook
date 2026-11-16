"use client";

import { CalendarOff, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/toggle";
import { formatTime, istToday, toIst } from "@/lib/time";
import { useIsClient } from "@/lib/use-is-client";
import { cn } from "@/lib/utils";
import type { AdminBooking, DaySchedule } from "@/server/admin/bookings";
import { BookingSheet } from "./booking-sheet";
import { STATUS_LABEL } from "./booking-ui";

const PX_PER_MIN = 1.6; // 30 min = 48px: room for time + name + service at 13px
const COLUMN_MIN_WIDTH = 168;

const TONES = 6;

/** Colour comes from the service category; status changes the treatment, not the hue. */
function blockTone(b: AdminBooking): string {
  if (b.status === "cancelled" || b.status === "no_show" || b.status === "expired") return "cal-tone-muted";
  return `cal-tone-${(b.category?.tone ?? 0) % TONES}`;
}

const STATUS_TREATMENT: Partial<Record<AdminBooking["status"], string>> = {
  // Awaiting payment: outlined and striped, like a tentative event.
  pending:
    "bg-[repeating-linear-gradient(135deg,var(--tone-bg)_0_6px,transparent_6px_12px)] outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-(--tone-bar)",
  no_show: "line-through decoration-1",
  cancelled: "line-through decoration-1",
};

/** "4:30 pm" → "4:30pm", "6:00 am" → "6am": compact, like a phone calendar. */
function shortTime(min: number) {
  return formatTime(min).replace(":00", "").replace(" ", "");
}

function useNowMinutes(date: string) {
  const isClient = useIsClient();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  if (!isClient) return null;
  const ist = toIst(now);
  return ist.date === date && date === istToday(now) ? ist.minutes : null;
}

export function DayCalendar({ schedule }: { schedule: DaySchedule }) {
  const router = useRouter();
  const [showCancelled, setShowCancelled] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, AdminBooking>>({});
  const nowMin = useNowMinutes(schedule.date);

  const bookings = useMemo(
    () => schedule.bookings.map((b) => overrides[b.id] ?? b).filter((b) => showCancelled || b.status !== "cancelled"),
    [schedule.bookings, overrides, showCancelled],
  );
  const selected = selectedId ? (overrides[selectedId] ?? schedule.bookings.find((b) => b.id === selectedId) ?? null) : null;

  // Visible range: opening hours widened to fit any shift or booking, snapped to whole hours.
  const range = useMemo(() => {
    const points = [
      ...(schedule.opening ? [schedule.opening.start, schedule.opening.end] : []),
      ...schedule.staff.flatMap((s) => s.shifts.flatMap((sh) => [sh.start, sh.end])),
      ...schedule.bookings.flatMap((b) => [b.startMin, b.endMin]),
    ];
    if (points.length === 0) return null;
    return { start: Math.floor(Math.min(...points) / 60) * 60, end: Math.ceil(Math.max(...points) / 60) * 60 };
  }, [schedule]);

  const legend = useMemo(() => {
    const seen = new Map<string, number>();
    for (const b of schedule.bookings) if (b.category) seen.set(b.category.name, b.category.tone);
    return [...seen].map(([name, tone]) => ({ name, tone })).sort((a, b) => a.tone - b.tone);
  }, [schedule.bookings]);

  const columns = schedule.staff.filter((s) => s.shifts.length > 0 || bookings.some((b) => b.staffId === s.id));

  if (!range || columns.length === 0) {
    return (
      <EmptyState icon={CalendarOff} title={schedule.closureReason ? `Closed: ${schedule.closureReason}` : "Nobody is working this day"}>
        No shifts or bookings for this date.
      </EmptyState>
    );
  }

  const height = (range.end - range.start) * PX_PER_MIN;
  const y = (min: number) => (min - range.start) * PX_PER_MIN;
  const hours = Array.from({ length: (range.end - range.start) / 60 + 1 }, (_, i) => range.start + i * 60);

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-muted">
          {schedule.closureReason ? <span className="font-medium text-danger">Closed: {schedule.closureReason} · </span> : null}
          {bookings.filter((b) => b.status !== "cancelled").length} bookings · {columns.length} artists
        </p>
        <div className="flex items-center gap-4">
          {legend.length > 1 && (
            <ul className="hidden items-center gap-3 text-[12px] text-muted md:flex" aria-label="Colours">
              {legend.map((c) => (
                <li key={c.name} className={cn("flex items-center gap-1.5", `cal-tone-${c.tone % TONES}`)}>
                  <span className="size-2 rounded-full bg-(--tone-bar)" aria-hidden />
                  {c.name}
                </li>
              ))}
            </ul>
          )}
          <label className="flex items-center gap-2 text-muted">
            <Checkbox checked={showCancelled} onCheckedChange={(v) => setShowCancelled(v === true)} /> Show cancelled
          </label>
        </div>
      </div>

      <div className="card thin-scroll max-h-[calc(100dvh-200px)] min-h-[420px] overflow-auto" role="region" aria-label="Day calendar">
        <div className="relative flex" style={{ minWidth: 56 + columns.length * COLUMN_MIN_WIDTH }}>
          {/* Time gutter (sticky left) */}
          <div className="sticky left-0 z-20 w-14 shrink-0 bg-surface">
            <div className="sticky top-0 z-10 h-12 border-b border-line bg-surface" />
            <div className="relative" style={{ height }}>
              {hours.map((h) => (
                <span
                  key={h}
                  // The first label sits below its line so it isn't cut off by the header.
                  className={cn("absolute right-2.5 text-[11px] text-muted tabular-nums", h === range.start ? "translate-y-0.5" : "-translate-y-1/2")}
                  style={{ top: y(h) }}
                >
                  {h < range.end ? shortTime(h) : ""}
                </span>
              ))}
            </div>
          </div>

          {columns.map((staff) => {
            const staffBookings = bookings.filter((b) => b.staffId === staff.id);
            return (
              <div key={staff.id} className="min-w-0 flex-1" style={{ minWidth: COLUMN_MIN_WIDTH }}>
                <div className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-line bg-surface px-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-hover text-[12px] font-semibold text-muted" aria-hidden>
                    {staff.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{staff.name}</p>
                    <p className="truncate text-[11px] text-muted tabular-nums">
                      {staff.shifts.length ? staff.shifts.map((s) => `${shortTime(s.start)}–${shortTime(s.end)}`).join(", ") : "Not on shift"}
                    </p>
                  </div>
                </div>
                <div className="relative border-l border-line bg-canvas" style={{ height }}>
                  {/* Working time is plain; off-shift time is greyed. */}
                  {staff.shifts.map((s, i) => (
                    <div key={i} className="absolute inset-x-0 bg-surface" style={{ top: y(s.start), height: (s.end - s.start) * PX_PER_MIN }} />
                  ))}
                  {hours.map((h) => (
                    <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line/70" style={{ top: y(h) }} />
                  ))}
                  {staff.leave.map((l, i) => (
                    <div
                      key={`leave-${i}`}
                      className="absolute inset-x-1 flex items-start justify-center rounded-lg bg-danger/5 pt-2 text-[11px] font-medium text-danger ring-1 ring-danger/20 ring-inset"
                      style={{ top: y(Math.max(l.start, range.start)), height: (Math.min(l.end, range.end) - Math.max(l.start, range.start)) * PX_PER_MIN }}
                    >
                      On leave
                    </div>
                  ))}
                  {staffBookings.map((b) => {
                    const blockHeight = Math.max((b.endMin - b.startMin) * PX_PER_MIN - 3, 22);
                    const services = b.items.map((i) => i.name).join(", ");
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedId(b.id)}
                        className={cn(
                          "absolute inset-x-1 overflow-hidden rounded-lg bg-(--tone-bg) py-1 pr-2 pl-3.5 text-left text-(--tone-fg) outline-none",
                          "transition-[filter,box-shadow] hover:brightness-[0.97] focus-visible:ring-3 focus-visible:ring-accent/30 dark:hover:brightness-110",
                          blockTone(b),
                          STATUS_TREATMENT[b.status],
                        )}
                        style={{ top: y(b.startMin) + 1.5, height: blockHeight }}
                        aria-label={`${formatTime(b.startMin)} ${b.customer.name}, ${services}, ${STATUS_LABEL[b.status]}`}
                      >
                        <span className="absolute top-1 bottom-1 left-1 w-[3px] rounded-full bg-(--tone-bar)" aria-hidden />
                        <span className="flex items-center gap-1 truncate text-[13px] leading-[18px] font-semibold">
                          {b.status === "completed" && <Check className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />}
                          <span className="truncate">{b.customer.name}</span>
                        </span>
                        <span className="block truncate text-[12px] leading-4 opacity-80 tabular-nums">
                          {b.status === "pending" ? "Awaiting payment · " : ""}
                          {shortTime(b.startMin)} – {shortTime(b.endMin)}
                          {b.refundDue && <span className="font-semibold text-warning"> · refund due</span>}
                        </span>
                        {blockHeight >= 56 && <span className="mt-0.5 block truncate text-[12px] leading-4 opacity-70">{services}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {nowMin !== null && nowMin >= range.start && nowMin <= range.end && (
            <div className="pointer-events-none absolute right-0 left-14 z-10 flex items-center" style={{ top: 48 + y(nowMin) }} aria-hidden>
              <span className="-ml-1 size-2.5 rounded-full bg-danger ring-2 ring-surface" />
              <span className="h-[1.5px] flex-1 bg-danger" />
            </div>
          )}
        </div>
      </div>

      <BookingSheet
        booking={selected}
        onClose={() => setSelectedId(null)}
        onUpdated={(b) => {
          setOverrides((o) => ({ ...o, [b.id]: b }));
          router.refresh();
        }}
      />
    </>
  );
}
