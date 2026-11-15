"use client";

import { CalendarOff } from "lucide-react";
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

const BLOCK_STYLE: Record<AdminBooking["status"], string> = {
  confirmed: "border-l-brand bg-accent-soft text-ink",
  pending: "border-l-warning border-dashed bg-warning/10 text-ink",
  completed: "border-l-success bg-success/10 text-ink",
  no_show: "border-l-danger bg-danger/10 text-ink line-through decoration-danger/50",
  cancelled: "border-l-line bg-hover text-muted line-through",
  expired: "border-l-line bg-hover text-muted",
};

const hatch = "bg-[repeating-linear-gradient(135deg,var(--hover)_0_6px,transparent_6px_12px)]";

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
        <label className="flex items-center gap-2 text-muted">
          <Checkbox checked={showCancelled} onCheckedChange={(v) => setShowCancelled(v === true)} /> Show cancelled
        </label>
      </div>

      <div className="card thin-scroll max-h-[calc(100dvh-200px)] min-h-[420px] overflow-auto" role="region" aria-label="Day calendar">
        <div className="relative flex" style={{ minWidth: 56 + columns.length * COLUMN_MIN_WIDTH }}>
          {/* Time gutter (sticky left) */}
          <div className="sticky left-0 z-20 w-14 shrink-0 border-r border-line bg-surface">
            <div className="sticky top-0 z-10 h-10 border-b border-line bg-surface" />
            <div className="relative" style={{ height }}>
              {hours.map((h) => (
                <span
                  key={h}
                  // The first label sits below its line so it isn't cut off by the header.
                  className={cn("absolute right-2 text-[11px] text-muted tabular-nums", h === range.start ? "translate-y-0.5" : "-translate-y-1/2")}
                  style={{ top: y(h) }}
                >
                  {h < range.end ? formatTime(h).replace(":00", "") : ""}
                </span>
              ))}
            </div>
          </div>

          {columns.map((staff) => {
            const staffBookings = bookings.filter((b) => b.staffId === staff.id);
            return (
              <div key={staff.id} className="min-w-0 flex-1 border-r border-line last:border-r-0" style={{ minWidth: COLUMN_MIN_WIDTH }}>
                <div className="sticky top-0 z-10 flex h-10 flex-col justify-center border-b border-line bg-surface px-2">
                  <p className="truncate text-[13px] font-medium">{staff.name}</p>
                  <p className="truncate text-[11px] text-muted tabular-nums">
                    {staff.shifts.length ? staff.shifts.map((s) => `${formatTime(s.start)}–${formatTime(s.end)}`).join(", ") : "Not on shift"}
                  </p>
                </div>
                <div className={cn("relative", hatch)} style={{ height }}>
                  {/* Working time is plain; everything else stays hatched. */}
                  {staff.shifts.map((s, i) => (
                    <div key={i} className="absolute inset-x-0 bg-surface" style={{ top: y(s.start), height: (s.end - s.start) * PX_PER_MIN }} />
                  ))}
                  {hours.map((h) => (
                    <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line" style={{ top: y(h) }} />
                  ))}
                  {hours.slice(0, -1).map((h) => (
                    <div key={`${h}-half`} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line/60" style={{ top: y(h + 30) }} />
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
                  {staffBookings.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedId(b.id)}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left outline-none transition-[box-shadow,filter]",
                        "hover:brightness-[0.97] focus-visible:ring-3 focus-visible:ring-accent/30",
                        BLOCK_STYLE[b.status],
                      )}
                      style={{ top: y(b.startMin) + 1, height: Math.max((b.endMin - b.startMin) * PX_PER_MIN - 2, 22) }}
                      aria-label={`${formatTime(b.startMin)} ${b.customer.name}, ${b.items.map((i) => i.name).join(", ")}, ${STATUS_LABEL[b.status]}`}
                    >
                      <span className="block truncate text-[11px] text-muted tabular-nums">
                        {formatTime(b.startMin)} – {formatTime(b.endMin)}
                        {b.refundDue && <span className="ml-1 font-medium text-warning">· refund due</span>}
                      </span>
                      <span className="block truncate font-medium">{b.customer.name}</span>
                      <span className="block truncate text-[12px] text-muted">{b.items.map((i) => i.name).join(", ")}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {nowMin !== null && nowMin >= range.start && nowMin <= range.end && (
            <div className="pointer-events-none absolute right-0 left-14 z-10 flex items-center" style={{ top: 40 + y(nowMin) }} aria-hidden>
              <span className="-ml-1 size-2 rounded-full bg-brand" />
              <span className="h-px flex-1 bg-brand" />
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
