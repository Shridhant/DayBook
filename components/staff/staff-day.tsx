"use client";

import { CalendarX2, Check, Clock, Phone, StickyNote, Undo2, UserX } from "lucide-react";
import { useState } from "react";
import { adminFetch, useMutation } from "@/components/admin/admin-kit";
import { SOURCE_LABEL, STATUS_LABEL, STATUS_TONE } from "@/components/admin/booking-ui";
import { Alert } from "@/components/ui/alert";
import { Code, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import type { StaffAction } from "@/lib/booking-status";
import { formatDuration, formatInstantTime, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { StaffBooking, StaffDay } from "@/server/staff-portal";

const ranges = (list: { start: number; end: number }[]) => list.map((r) => `${formatTime(r.start)} – ${formatTime(r.end % 1440)}`).join(", ");

/** One line about the technician's day: shift, leave, or closure. */
function DaySummary({ day }: { day: StaffDay }) {
  if (day.closureReason) return <Alert size="app" tone="warning">The salon is closed: {day.closureReason}</Alert>;
  const fullDayLeave = day.leave.some((l) => l.start === 0 && l.end === 1440);
  if (fullDayLeave) return <Alert size="app">You&apos;re on leave this day.</Alert>;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
      <span className="flex items-center gap-1.5">
        <Clock aria-hidden className="size-4" />
        {day.shifts.length ? `On shift ${ranges(day.shifts)}` : "No shift this day"}
      </span>
      {day.leave.length > 0 && <span>Leave {ranges(day.leave)}</span>}
    </p>
  );
}

export function StaffDayView({ day }: { day: StaffDay }) {
  const active = day.bookings.filter((b) => b.status === "confirmed").length;
  return (
    <div className="space-y-4">
      <DaySummary day={day} />
      {day.bookings.length === 0 ? (
        <EmptyState icon={CalendarX2} title="No appointments">
          Nothing booked with you this day. New bookings appear here as soon as they&apos;re confirmed.
        </EmptyState>
      ) : (
        <>
          <p className="text-xs text-muted">
            {day.bookings.length} appointment{day.bookings.length === 1 ? "" : "s"}
            {active < day.bookings.length && ` · ${active} still to do`}
          </p>
          <ol className="space-y-3">
            {day.bookings.map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

const ACTION_DONE: Record<StaffAction, string> = { complete: "Marked as done", no_show: "Marked as no-show", reopen: "Undone" };

function BookingCard({ booking: b }: { booking: StaffBooking }) {
  const { run, busy } = useMutation();
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const start = new Date(b.startsAt);
  const end = new Date(b.endsAt);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  const closed = b.status !== "confirmed";

  const act = (action: StaffAction) =>
    run(() => adminFetch(`/api/staff/bookings/${b.id}`, { method: "POST", body: { action } }), ACTION_DONE[action]);

  return (
    <li className={cn("card rounded-xl p-4", closed && "opacity-75")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tabular-nums">
            {formatInstantTime(start)} – {formatInstantTime(end)}
          </p>
          <p className="text-xs text-muted">{formatDuration(minutes)}</p>
        </div>
        <StatusPill tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</StatusPill>
      </div>

      <div className="mt-3">
        <p className="font-medium">{b.customer.name}</p>
        {b.customer.phone && (
          <a href={`tel:+91${b.customer.phone}`} className="mt-0.5 inline-flex items-center gap-1.5 text-accent hover:underline">
            <Phone aria-hidden className="size-3.5" />
            {b.customer.phone}
          </a>
        )}
      </div>

      <ul className="mt-2 space-y-0.5">
        {b.items.map((item, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span>{item.name}</span>
            <span className="text-muted tabular-nums">{formatDuration(item.durationMin)}</span>
          </li>
        ))}
      </ul>

      {b.notes && (
        <p className="mt-3 flex gap-2 rounded-lg bg-hover px-3 py-2">
          <StickyNote aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
          <span className="min-w-0 break-words">{b.notes}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-xs text-muted">
          <Code>{b.code}</Code> · {SOURCE_LABEL[b.source]}
        </span>
        {b.actions.length > 0 && (
          <div className="flex gap-2">
            {b.actions.includes("no_show") && (
              <Button size="md" className="h-11 px-4" disabled={busy} onClick={() => setConfirmNoShow(true)}>
                <UserX /> No-show
              </Button>
            )}
            {b.actions.includes("complete") && (
              <Button variant="primary" size="md" className="h-11 px-4" loading={busy} onClick={() => act("complete")}>
                <Check /> Done
              </Button>
            )}
            {b.actions.includes("reopen") && (
              <Button variant="ghost" size="md" className="h-11 px-4" loading={busy} onClick={() => act("reopen")}>
                <Undo2 /> Undo
              </Button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmNoShow}
        onOpenChange={setConfirmNoShow}
        title={`Mark ${b.customer.name} as a no-show?`}
        description="Only if they didn't come. The front desk sees this, and you can undo it for a week."
        confirmLabel="Mark no-show"
        tone="danger"
        onConfirm={async () => {
          await act("no_show");
        }}
      />
    </li>
  );
}
