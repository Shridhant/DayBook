"use client";

import { CalendarPlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { adminFetch, useMutation } from "@/components/admin/admin-kit";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/toggle";
import { formatLeaveRange } from "@/lib/time";
import type { LeaveStatus, OwnLeave } from "@/server/staff-portal";

const STATUS: Record<LeaveStatus, { label: string; tone: "warning" | "success" | "danger" }> = {
  requested: { label: "Waiting for approval", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Declined", tone: "danger" },
};

export function StaffLeave({ leave, today }: { leave: OwnLeave[]; today: string }) {
  return (
    <div className="space-y-4">
      <RequestForm today={today} />
      <Section title="Your leave" description="Upcoming leave, and anything answered in the last 30 days.">
        {leave.length === 0 ? (
          <p className="text-muted">No leave yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {leave.map((l) => (
              <LeaveRow key={l.id} leave={l} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function RequestForm({ today }: { today: string }) {
  const { run, busy } = useMutation();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [partDay, setPartDay] = useState(false);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");

  async function submit() {
    const ok = await run(
      () =>
        adminFetch("/api/staff/leave", {
          method: "POST",
          body: { startDate, endDate: partDay ? startDate : endDate || startDate, ...(partDay ? { startTime, endTime } : {}), reason },
        }),
      "Request sent to the front desk",
    );
    if (ok) {
      setStartDate("");
      setEndDate("");
      setReason("");
    }
  }

  return (
    <Section icon={CalendarPlus} title="Request leave">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={partDay ? "Date" : "From"}>
          <Input type="date" className="h-11" min={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        {partDay ? (
          <div className="flex items-end gap-2">
            <Field label="From" className="flex-1">
              <Input type="time" className="h-11" step={300} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
            <Field label="To" className="flex-1">
              <Input type="time" className="h-11" step={300} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </Field>
          </div>
        ) : (
          <Field label="To (inclusive)" hint="Leave empty for one day">
            <Input type="date" className="h-11" value={endDate} min={startDate || today} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        )}
        <Field label="Reason (optional)" className="sm:col-span-2">
          <Input className="h-11" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Wedding, doctor…" />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2">
          <Checkbox checked={partDay} onCheckedChange={(v) => setPartDay(v === true)} /> Part of a day
        </label>
        <Button variant="primary" size="lg" className="h-11 px-5" loading={busy} disabled={!startDate} onClick={submit}>
          Send request
        </Button>
      </div>
    </Section>
  );
}

function LeaveRow({ leave: l }: { leave: OwnLeave }) {
  const { run } = useMutation();
  const [confirm, setConfirm] = useState(false);
  const status = STATUS[l.status];
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-3">
      <div className="min-w-0">
        <p className="font-medium tabular-nums">{formatLeaveRange(new Date(l.startsAt), new Date(l.endsAt))}</p>
        {l.reason && <p className="text-xs text-muted">{l.reason}</p>}
        <StatusPill tone={status.tone} className="mt-1.5">
          {status.label}
        </StatusPill>
        {l.decisionNote && <p className="mt-1 text-xs text-muted">Front desk: {l.decisionNote}</p>}
      </div>
      {l.status === "requested" && (
        <>
          <Button variant="ghost" size="icon" className="size-11" aria-label="Withdraw request" onClick={() => setConfirm(true)}>
            <Trash2 />
          </Button>
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title="Withdraw this request?"
            confirmLabel="Withdraw"
            tone="danger"
            onConfirm={async () => {
              await run(() => adminFetch(`/api/staff/leave/${l.id}`, { method: "DELETE" }), "Request withdrawn");
            }}
          />
        </>
      )}
    </li>
  );
}
