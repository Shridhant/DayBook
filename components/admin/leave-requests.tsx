"use client";

import { CalendarOff, Check, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Count } from "@/components/ui/badge";
import { Section } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { formatDate, formatLeaveRange, toIst } from "@/lib/time";
import type { LeaveRequest } from "@/server/admin/staff-admin";
import { adminFetch, ClashDialog, useMutation, type Clash } from "./admin-kit";

type Decision = { saved: boolean; clashes: Clash[] };

/** Technicians' unanswered leave requests (front desk). Approving checks for clashing bookings first. */
export function LeaveRequests({ requests }: { requests: LeaveRequest[] }) {
  return (
    <div id="leave-requests" className="scroll-mt-16">
      <Section
        icon={CalendarOff}
        title={
          <span className="flex items-center gap-2">
            Leave requests <Count>{requests.length}</Count>
          </span>
        }
        description="Approved leave blocks online booking for that artist."
      >
        <ul className="divide-y divide-line rounded-lg border border-line">
          {requests.map((r) => (
            <RequestRow key={r.id} request={r} />
          ))}
        </ul>
      </Section>
    </div>
  );
}

function RequestRow({ request: r }: { request: LeaveRequest }) {
  const { run, busy } = useMutation();
  const [clashes, setClashes] = useState<Clash[] | null>(null);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");

  const decide = (approve: boolean, force = false) =>
    run(
      () => adminFetch<Decision>(`/api/admin/leave/${r.id}`, { method: "PATCH", body: { approve, force, note: approve ? null : note } }),
      (result) => {
        setClashes(result.saved ? null : result.clashes);
        if (result.saved) setDeclining(false);
        return result.saved ? (approve ? `Leave approved for ${r.staffName}` : "Request declined") : null;
      },
    );

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p>
          <span className="font-medium">{r.staffName}</span> <span className="tabular-nums">· {formatLeaveRange(new Date(r.startsAt), new Date(r.endsAt))}</span>
        </p>
        <p className="text-xs text-muted">
          {r.reason ? `${r.reason} · ` : ""}asked {formatDate(toIst(new Date(r.requestedAt)).date)}
          {r.clashCount > 0 && <span className="text-warning"> · overlaps {r.clashCount} booking{r.clashCount === 1 ? "" : "s"}</span>}
        </p>
      </div>
      <div className="flex gap-1.5">
        <Button size="md" disabled={busy} onClick={() => setDeclining(true)}>
          <X /> Decline
        </Button>
        <Button size="md" variant="primary" loading={busy && !declining && !clashes} onClick={() => decide(true)}>
          <Check /> Approve
        </Button>
      </div>

      <ClashDialog
        clashes={clashes}
        title="This leave overlaps bookings"
        description="Approve it anyway? The bookings below stay on the calendar until you move them."
        busy={busy}
        onCancel={() => setClashes(null)}
        onConfirm={() => decide(true, true)}
      />

      <Dialog open={declining} onOpenChange={(o) => !busy && setDeclining(o)}>
        {declining && (
          <DialogContent
            size="sm"
            title={`Decline ${r.staffName}'s request?`}
            description={formatLeaveRange(new Date(r.startsAt), new Date(r.endsAt))}
            footer={
              <>
                <Button size="md" onClick={() => setDeclining(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button size="md" variant="primary" loading={busy} onClick={() => decide(false)}>
                  Decline
                </Button>
              </>
            }
          >
            <Field label="Note for the artist (optional)">
              <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Busy Saturday, can you take Monday?" />
            </Field>
          </DialogContent>
        )}
      </Dialog>
    </li>
  );
}
