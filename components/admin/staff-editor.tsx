"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/calendar";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Checkbox, Switch } from "@/components/ui/toggle";
import { useMotionSafe } from "@/lib/use-motion-safe";
import { formatLeaveRange } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { AdminCategory, AdminService } from "@/server/admin/services-admin";
import type { StaffDetail } from "@/server/admin/staff-admin";
import { adminFetch, ClashDialog, ImageUpload, useMutation, type Clash } from "./admin-kit";

/**
 * One artist, as a single settings column: each part is a row (title and help on the left,
 * controls on the right) divided by hairlines instead of separate cards. Each part still saves on
 * its own (they're separate API calls), but its Save button only appears once something changed.
 */

// Monday-first, as the salon reads a week. Values are Postgres weekdays (0 = Sunday).
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Range = { start: string; end: string };

export function StaffEditor({
  staff,
  categories,
  services,
  canEdit,
}: {
  staff: StaffDetail;
  categories: AdminCategory[];
  services: AdminService[];
  canEdit: boolean;
}) {
  const workDays = WEEK.filter((d) => staff.shifts.some((s) => s.weekday === d)).length;
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/staff" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
        <ChevronLeft className="size-3.5" aria-hidden />
        Artists
      </Link>

      <div className="mt-3 flex items-center gap-4 border-b border-line pb-6">
        <Avatar name={staff.name} src={staff.photoPath} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-semibold tracking-tight">{staff.name}</h2>
            <StatusPill tone={staff.active ? "success" : "neutral"}>{staff.active ? "Bookable" : "Hidden from booking"}</StatusPill>
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {[
              staff.specialties,
              `${staff.serviceIds.length} service${staff.serviceIds.length === 1 ? "" : "s"}`,
              `${workDays} day${workDays === 1 ? "" : "s"} a week`,
              `${staff.upcomingBookings} upcoming booking${staff.upcomingBookings === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {!canEdit && <p className="mt-4 rounded-lg bg-hover px-3 py-2 text-[13px] text-muted">Only the owner can change profiles, services and hours.</p>}

      <ProfileSection staff={staff} canEdit={canEdit} />
      <SkillsSection staff={staff} categories={categories} services={services} canEdit={canEdit} />
      <ShiftsSection staff={staff} canEdit={canEdit} />
      <LeaveSection staff={staff} />
    </div>
  );
}

/* ---------- Layout ---------- */

function Row({ title, description, children, last = false }: { title: string; description: ReactNode; children: ReactNode; last?: boolean }) {
  return (
    <section className={cn("grid gap-x-10 gap-y-4 py-8 md:grid-cols-[220px_minmax(0,1fr)]", !last && "border-b border-line")}>
      <div>
        <h3 className="text-[14px] font-semibold">{title}</h3>
        <p className="mt-1 text-[13px] text-muted">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Appears under a section once it has unsaved edits. */
function SaveBar({ show, busy, disabled, label, onSave, onReset }: { show: boolean; busy: boolean; disabled?: boolean; label: string; onSave: () => void; onReset: () => void }) {
  const m = useMotionSafe({ initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } }, { duration: 0.16 });
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div {...m} className="mt-5 flex items-center justify-end gap-2">
          <span className="mr-auto text-xs text-muted">Unsaved changes</span>
          <Button variant="ghost" size="md" onClick={onReset} disabled={busy}>
            Discard
          </Button>
          <Button variant="primary" size="md" loading={busy} disabled={disabled} onClick={onSave}>
            {label}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Profile ---------- */

function ProfileSection({ staff, canEdit }: { staff: StaffDetail; canEdit: boolean }) {
  const { run, busy } = useMutation();
  const initial = { name: staff.name, specialties: staff.specialties ?? "", bio: staff.bio ?? "", photo: staff.photoPath, active: staff.active };
  const [form, setForm] = useState(initial);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = () =>
    run(
      () =>
        adminFetch(`/api/admin/staff/${staff.id}`, {
          method: "PATCH",
          body: { name: form.name, specialties: form.specialties, bio: form.bio, photoPath: form.photo, active: form.active },
        }),
      "Profile saved",
    );

  return (
    <Row title="Profile" description="Shown in the team section of the website.">
      <fieldset disabled={!canEdit} className="grid gap-5 sm:grid-cols-[112px_minmax(0,1fr)]">
        <ImageUpload kind="staff" value={form.photo} onChange={(img) => set({ photo: img?.path ?? null })} label="Add photo" className="w-28" />
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={form.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Specialties">
              <Input value={form.specialties} maxLength={120} onChange={(e) => set({ specialties: e.target.value })} placeholder="Extensions, nail art" />
            </Field>
          </div>
          <Field label="Short bio" hint="Optional">
            <Textarea rows={2} value={form.bio} maxLength={600} onChange={(e) => set({ bio: e.target.value })} />
          </Field>
          <label className="flex items-start justify-between gap-4 rounded-lg border border-line px-3 py-2.5">
            <span>
              <span className="block text-[13px] font-medium">Bookable online</span>
              <span className="block text-xs text-muted">Turn off to hide this artist from the booking page and website.</span>
            </span>
            <Switch checked={form.active} onCheckedChange={(active) => set({ active })} />
          </label>
          {!form.active && staff.active && staff.upcomingBookings > 0 && (
            <p className="text-xs text-warning">
              {staff.upcomingBookings} upcoming booking{staff.upcomingBookings === 1 ? "" : "s"} stay on the calendar; reassign them first.
            </p>
          )}
        </div>
      </fieldset>
      {canEdit && <SaveBar show={dirty} busy={busy} disabled={form.name.trim().length < 2} label="Save profile" onSave={save} onReset={() => setForm(initial)} />}
    </Row>
  );
}

/* ---------- Services ---------- */

function SkillsSection({
  staff,
  categories,
  services,
  canEdit,
}: {
  staff: StaffDetail;
  categories: AdminCategory[];
  services: AdminService[];
  canEdit: boolean;
}) {
  const { run, busy } = useMutation();
  const [selected, setSelected] = useState<string[]>(staff.serviceIds);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const dirty = [...selected].sort().join() !== [...staff.serviceIds].sort().join();

  return (
    <Row title="Services" description={`Customers can only book ${staff.name.split(" ")[0]} for ticked services. ${selected.length} of ${services.length} ticked.`}>
      <fieldset disabled={!canEdit} className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {categories.map((c) => {
          const list = services.filter((s) => s.categoryId === c.id);
          if (!list.length) return null;
          const all = list.every((s) => selected.includes(s.id));
          return (
            <div key={c.id}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted">
                  {c.name} <span className="tabular-nums">· {list.filter((s) => selected.includes(s.id)).length}/{list.length}</span>
                </p>
                {canEdit && (
                  <button
                    type="button"
                    className="text-xs text-muted hover:text-ink"
                    onClick={() =>
                      setSelected((sel) => (all ? sel.filter((id) => !list.some((s) => s.id === id)) : [...new Set([...sel, ...list.map((s) => s.id)])]))
                    }
                  >
                    {all ? "Clear" : "All"}
                  </button>
                )}
              </div>
              {list.map((s) => (
                <label key={s.id} className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover">
                  <Checkbox checked={selected.includes(s.id)} onCheckedChange={() => toggle(s.id)} />
                  <span className={s.active ? undefined : "text-muted line-through"}>{s.name}</span>
                </label>
              ))}
            </div>
          );
        })}
      </fieldset>
      {canEdit && (
        <SaveBar
          show={dirty}
          busy={busy}
          label="Save services"
          onSave={() => run(() => adminFetch(`/api/admin/staff/${staff.id}/skills`, { method: "PUT", body: { serviceIds: selected } }), "Services saved")}
          onReset={() => setSelected(staff.serviceIds)}
        />
      )}
    </Row>
  );
}

/* ---------- Weekly hours ---------- */

function initialWeek(staff: StaffDetail): Record<number, Range[]> {
  return Object.fromEntries(WEEK.map((d) => [d, staff.shifts.filter((s) => s.weekday === d).map((s) => ({ start: s.start, end: s.end }))]));
}

function ShiftsSection({ staff, canEdit }: { staff: StaffDetail; canEdit: boolean }) {
  const { run, busy } = useMutation();
  const [week, setWeek] = useState(() => initialWeek(staff));
  const [clashes, setClashes] = useState<Clash[] | null>(null);
  const dirty = JSON.stringify(week) !== JSON.stringify(initialWeek(staff));

  const setDay = (day: number, ranges: Range[]) => setWeek((w) => ({ ...w, [day]: ranges }));
  const payload = (force: boolean) => ({
    shifts: WEEK.flatMap((weekday) => week[weekday].map((r) => ({ weekday, ...r }))),
    force,
  });

  async function save(force: boolean) {
    await run(
      () => adminFetch<{ saved: boolean; clashes: Clash[] }>(`/api/admin/staff/${staff.id}/shifts`, { method: "PUT", body: payload(force) }),
      (result) => {
        setClashes(result.saved ? null : result.clashes);
        return result.saved ? "Hours saved" : null;
      },
    );
  }

  return (
    <Row title="Weekly hours" description="Repeats every week. Add a second time range for a break.">
      <fieldset disabled={!canEdit} className="divide-y divide-line rounded-xl border border-line">
        {WEEK.map((day) => {
          const ranges = week[day];
          const works = ranges.length > 0;
          return (
            <div key={day} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
              <label className="flex w-36 items-center gap-2.5">
                <Switch checked={works} onCheckedChange={(on) => setDay(day, on ? [{ start: "11:00", end: "20:00" }] : [])} aria-label={`Works on ${DAY[day]}`} />
                <span className={works ? "font-medium" : "text-muted"}>{DAY[day]}</span>
              </label>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
                {!works && <span className="text-[13px] text-muted">Day off</span>}
                {ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input
                      type="time"
                      step={300}
                      value={r.start}
                      className="w-[7.5rem]"
                      aria-label={`${DAY[day]} start`}
                      onChange={(e) => setDay(day, ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                    />
                    <span className="text-muted">–</span>
                    <Input
                      type="time"
                      step={300}
                      value={r.end}
                      className="w-[7.5rem]"
                      aria-label={`${DAY[day]} end`}
                      onChange={(e) => setDay(day, ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                    />
                    {canEdit && ranges.length > 1 && (
                      <Button variant="ghost" size="icon" aria-label="Remove time range" onClick={() => setDay(day, ranges.filter((_, j) => j !== i))}>
                        <X />
                      </Button>
                    )}
                  </div>
                ))}
                {canEdit && works && ranges.length < 3 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Add a time range on ${DAY[day]}`}
                    title="Add a time range"
                    onClick={() => setDay(day, [...ranges, { start: ranges.at(-1)?.end ?? "16:00", end: "20:00" }])}
                  >
                    <Plus />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </fieldset>
      {canEdit && <SaveBar show={dirty} busy={busy && !clashes} label="Save hours" onSave={() => save(false)} onReset={() => setWeek(initialWeek(staff))} />}
      <ClashDialog
        clashes={clashes}
        title="Some bookings fall outside these hours"
        description="Save the new hours anyway? The bookings below won't move automatically."
        busy={busy}
        onCancel={() => setClashes(null)}
        onConfirm={() => save(true)}
      />
    </Row>
  );
}

/* ---------- Leave ---------- */

function LeaveSection({ staff }: { staff: StaffDetail }) {
  const { run, busy } = useMutation();
  const [adding, setAdding] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [partDay, setPartDay] = useState(false);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [clashes, setClashes] = useState<Clash[] | null>(null);
  const m = useMotionSafe({ initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: "auto" }, exit: { opacity: 0, height: 0 } }, { duration: 0.2 });

  function reset() {
    setAdding(false);
    setStartDate("");
    setEndDate("");
    setReason("");
    setPartDay(false);
  }

  async function add(force: boolean) {
    let saved = false;
    await run(
      () =>
        adminFetch<{ saved: boolean; clashes: Clash[] }>(`/api/admin/staff/${staff.id}/leave`, {
          method: "POST",
          body: { startDate, endDate: partDay ? startDate : endDate || startDate, ...(partDay ? { startTime, endTime } : {}), reason, force },
        }),
      (result) => {
        saved = result.saved;
        setClashes(result.saved ? null : result.clashes);
        return result.saved ? "Leave added" : null;
      },
    );
    if (saved) reset();
  }

  return (
    <Row title="Leave" description="Time off blocks online booking for those dates." last>
      {staff.leave.length > 0 ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {staff.leave.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-2 pr-1.5 pl-3">
              <span className="min-w-0">
                <span className="block font-medium tabular-nums">{formatLeaveRange(new Date(l.startsAt), new Date(l.endsAt))}</span>
                {l.reason && <span className="block truncate text-xs text-muted">{l.reason}</span>}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove leave"
                onClick={() => run(() => adminFetch(`/api/admin/leave/${l.id}`, { method: "DELETE" }), "Leave removed")}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">No upcoming leave.</p>
      )}

      {!adding && (
        <Button size="md" className="mt-3" onClick={() => setAdding(true)}>
          <Plus /> Add leave
        </Button>
      )}

      <AnimatePresence initial={false}>
        {adding && (
          <motion.div {...m} className="overflow-hidden">
            <div className="mt-4 rounded-xl border border-line bg-canvas p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={partDay ? "Date" : "From"}>
                  <DateField value={startDate} onChange={setStartDate} />
                </Field>
                {partDay ? (
                  <div className="flex items-end gap-1.5">
                    <Field label="From" className="flex-1">
                      <Input type="time" step={300} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                    </Field>
                    <Field label="To" className="flex-1">
                      <Input type="time" step={300} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                    </Field>
                  </div>
                ) : (
                  <Field label="To (inclusive)" hint="Leave empty for one day">
                    <DateField value={endDate} minDate={startDate || undefined} onChange={setEndDate} placeholder="Same day" clearable />
                  </Field>
                )}
                <Field label="Reason (optional)" className="sm:col-span-2">
                  <Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Wedding, doctor…" />
                </Field>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2">
                  <Checkbox checked={partDay} onCheckedChange={(v) => setPartDay(v === true)} /> Part of a day
                </label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="md" onClick={reset} disabled={busy}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="md" loading={busy && !clashes} disabled={!startDate} onClick={() => add(false)}>
                    Add leave
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ClashDialog
        clashes={clashes}
        title="This leave overlaps bookings"
        description="Add the leave anyway? The bookings below stay on the calendar until you move them."
        busy={busy}
        onCancel={() => setClashes(null)}
        onConfirm={() => add(true)}
      />
    </Row>
  );
}
