"use client";

import { CalendarOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Section } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/calendar";
import { formatDate, istToday } from "@/lib/time";
import { useIsClient } from "@/lib/use-is-client";
import type { AdminClosure } from "@/server/admin/settings-admin";
import { adminFetch, ClashDialog, useMutation, type Clash } from "./admin-kit";

export function ClosuresManager({ closures }: { closures: AdminClosure[] }) {
  const { run, busy } = useMutation();
  const isClient = useIsClient();
  const today = isClient ? istToday() : null;
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [clashes, setClashes] = useState<Clash[] | null>(null);

  async function add(force: boolean) {
    let saved = false;
    await run(
      () => adminFetch<{ saved: boolean; clashes: Clash[] }>("/api/admin/closures", { method: "POST", body: { date, reason, force } }),
      (result) => {
        saved = result.saved;
        setClashes(result.saved ? null : result.clashes);
        return result.saved ? "Closure added" : null;
      },
    );
    if (saved) {
      setDate("");
      setReason("");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        {closures.length === 0 ? (
          <EmptyState icon={CalendarOff} title="No closures planned">
            Add holidays so customers can&apos;t book those days.
          </EmptyState>
        ) : (
          <div className="card divide-y divide-line">
            {closures.map((c) => {
              const past = today !== null && c.date < today;
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className={past ? "text-muted" : undefined}>
                    <p className="font-medium">{formatDate(c.date, { year: true })}</p>
                    <p className="text-xs text-muted">{c.reason ?? "Closed"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.bookings > 0 && <Chip tone="warning">{c.bookings} booking{c.bookings === 1 ? "" : "s"} that day</Chip>}
                    {past && <Chip>Past</Chip>}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove closure on ${formatDate(c.date)}`}
                      onClick={() => run(() => adminFetch(`/api/admin/closures/${c.id}`, { method: "DELETE" }), "Closure removed")}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Section icon={CalendarOff} title="Close a day" className="h-fit">
        <div className="space-y-3">
          <Field label="Date">
            <DateField value={date} minDate={today ?? undefined} onChange={setDate} />
          </Field>
          <Field label="Reason (optional)" hint="Shown on the booking page">
            <Input value={reason} maxLength={120} placeholder="Diwali" onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button variant="primary" size="md" block loading={busy && !clashes} disabled={!date} onClick={() => add(false)}>
            Close this day
          </Button>
        </div>
      </Section>

      <ClashDialog
        clashes={clashes}
        title="There are bookings that day"
        description="Close the day anyway? Existing bookings stay; contact these customers to move them."
        busy={busy}
        onCancel={() => setClashes(null)}
        onConfirm={() => add(true)}
      />
    </div>
  );
}
