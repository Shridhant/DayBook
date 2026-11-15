"use client";

import { CalendarOff, Clock, Plus, Scissors, Trash2, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Checkbox, Switch } from "@/components/ui/toggle";
import { formatDate, formatInstantTime, toIst } from "@/lib/time";
import type { AdminCategory, AdminService } from "@/server/admin/services-admin";
import type { StaffDetail } from "@/server/admin/staff-admin";
import { adminFetch, ClashDialog, ImageUpload, useMutation, type Clash } from "./admin-kit";

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
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="min-w-0">
        <ProfileSection staff={staff} canEdit={canEdit} />
        <SkillsSection staff={staff} categories={categories} services={services} canEdit={canEdit} />
      </div>
      <div className="min-w-0">
        <ShiftsSection staff={staff} canEdit={canEdit} />
        <LeaveSection staff={staff} />
      </div>
    </div>
  );
}

function ProfileSection({ staff, canEdit }: { staff: StaffDetail; canEdit: boolean }) {
  const { run, busy } = useMutation();
  const [name, setName] = useState(staff.name);
  const [specialties, setSpecialties] = useState(staff.specialties ?? "");
  const [bio, setBio] = useState(staff.bio ?? "");
  const [photo, setPhoto] = useState(staff.photoPath);
  const [active, setActive] = useState(staff.active);

  const save = () =>
    run(
      () => adminFetch(`/api/admin/staff/${staff.id}`, { method: "PATCH", body: { name, specialties, bio, photoPath: photo, active } }),
      "Profile saved",
    );

  return (
    <Section icon={UserRound} title="Profile" description={canEdit ? "Shown on the website's team section." : "Only the owner can edit."}>
      <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
        <ImageUpload kind="staff" value={photo} onChange={(img) => setPhoto(img?.path ?? null)} label="Add photo" className="w-36 sm:w-auto" />
        <div className="space-y-3">
          <Field label="Name">
            <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Specialties">
            <Input value={specialties} maxLength={120} onChange={(e) => setSpecialties(e.target.value)} placeholder="Extensions, nail art" />
          </Field>
          <Field label="Short bio" hint="Optional">
            <Textarea rows={2} value={bio} maxLength={600} onChange={(e) => setBio(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} /> Active (bookable)
          </label>
          {!active && staff.active && staff.upcomingBookings > 0 && (
            <p className="text-xs text-warning">
              {staff.upcomingBookings} upcoming booking{staff.upcomingBookings === 1 ? "" : "s"} stay on the calendar; reassign them first.
            </p>
          )}
        </div>
      </fieldset>
      {canEdit && (
        <div className="mt-4 flex justify-end">
          <Button variant="primary" size="md" loading={busy} disabled={name.trim().length < 2} onClick={save}>
            Save profile
          </Button>
        </div>
      )}
    </Section>
  );
}

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

  return (
    <Section icon={Scissors} title="Services" description="Customers can only book this artist for ticked services.">
      <fieldset disabled={!canEdit} className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {categories.map((c) => {
          const list = services.filter((s) => s.categoryId === c.id);
          if (!list.length) return null;
          return (
            <div key={c.id}>
              <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{c.name}</p>
              {list.map((s) => (
                <label key={s.id} className="flex items-center gap-2 py-1">
                  <Checkbox checked={selected.includes(s.id)} onCheckedChange={() => toggle(s.id)} />
                  <span className={s.active ? undefined : "text-muted line-through"}>{s.name}</span>
                </label>
              ))}
            </div>
          );
        })}
      </fieldset>
      {canEdit && (
        <div className="mt-4 flex justify-end">
          <Button
            variant="primary"
            size="md"
            loading={busy}
            onClick={() => run(() => adminFetch(`/api/admin/staff/${staff.id}/skills`, { method: "PUT", body: { serviceIds: selected } }), "Services saved")}
          >
            Save services
          </Button>
        </div>
      )}
    </Section>
  );
}

function ShiftsSection({ staff, canEdit }: { staff: StaffDetail; canEdit: boolean }) {
  const { run, busy } = useMutation();
  const [week, setWeek] = useState<Record<number, Range[]>>(() =>
    Object.fromEntries(WEEK.map((d) => [d, staff.shifts.filter((s) => s.weekday === d).map((s) => ({ start: s.start, end: s.end }))])),
  );
  const [clashes, setClashes] = useState<Clash[] | null>(null);

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
    <Section icon={Clock} title="Weekly hours" description="Repeats every week. Add a second range for a break.">
      <fieldset disabled={!canEdit} className="divide-y divide-line">
        {WEEK.map((day) => {
          const ranges = week[day];
          const works = ranges.length > 0;
          return (
            <div key={day} className="flex flex-wrap items-start gap-3 py-2.5">
              <label className="flex w-32 items-center gap-2 pt-1">
                <Switch checked={works} onCheckedChange={(on) => setDay(day, on ? [{ start: "11:00", end: "20:00" }] : [])} />
                <span className={works ? "font-medium" : "text-muted"}>{DAY[day]}</span>
              </label>
              <div className="min-w-0 flex-1 space-y-1.5">
                {!works && <p className="pt-1 text-muted">Day off</p>}
                {ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input
                      type="time"
                      step={300}
                      value={r.start}
                      className="w-28"
                      aria-label={`${DAY[day]} start`}
                      onChange={(e) => setDay(day, ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                    />
                    <span className="text-muted">to</span>
                    <Input
                      type="time"
                      step={300}
                      value={r.end}
                      className="w-28"
                      aria-label={`${DAY[day]} end`}
                      onChange={(e) => setDay(day, ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                    />
                    {canEdit && ranges.length > 1 && (
                      <Button variant="ghost" size="icon" aria-label="Remove range" onClick={() => setDay(day, ranges.filter((_, j) => j !== i))}>
                        <X />
                      </Button>
                    )}
                  </div>
                ))}
                {canEdit && works && ranges.length < 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDay(day, [...ranges, { start: ranges.at(-1)?.end ?? "16:00", end: "20:00" }])}
                  >
                    <Plus /> Add range
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </fieldset>
      {canEdit && (
        <div className="mt-4 flex justify-end">
          <Button variant="primary" size="md" loading={busy && !clashes} onClick={() => save(false)}>
            Save hours
          </Button>
        </div>
      )}
      <ClashDialog
        clashes={clashes}
        title="Some bookings fall outside these hours"
        description="Save the new hours anyway? The bookings below won't move automatically."
        busy={busy}
        onCancel={() => setClashes(null)}
        onConfirm={() => save(true)}
      />
    </Section>
  );
}

function LeaveSection({ staff }: { staff: StaffDetail }) {
  const { run, busy } = useMutation();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [partDay, setPartDay] = useState(false);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [clashes, setClashes] = useState<Clash[] | null>(null);

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
    if (saved) {
      setStartDate("");
      setEndDate("");
      setReason("");
    }
  }

  return (
    <Section icon={CalendarOff} title="Leave" description="Time off blocks online booking for these dates.">
      {staff.leave.length > 0 ? (
        <ul className="mb-4 divide-y divide-line rounded-lg border border-line">
          {staff.leave.map((l) => {
            const s = new Date(l.startsAt);
            const e = new Date(l.endsAt);
            return (
              <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>
                  <span className="font-medium tabular-nums">
                    {formatDate(toIst(s).date)} {formatInstantTime(s)} → {formatDate(toIst(new Date(e.getTime() - 1)).date)} {formatInstantTime(e)}
                  </span>
                  {l.reason && <span className="block text-xs text-muted">{l.reason}</span>}
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
            );
          })}
        </ul>
      ) : (
        <p className="mb-4 text-muted">No upcoming leave.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={partDay ? "Date" : "From"}>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
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
            <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        )}
        <Field label="Reason (optional)" className="sm:col-span-2">
          <Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Wedding, doctor…" />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2">
          <Checkbox checked={partDay} onCheckedChange={(v) => setPartDay(v === true)} /> Part of a day
        </label>
        <Button variant="primary" size="md" loading={busy && !clashes} disabled={!startDate} onClick={() => add(false)}>
          Add leave
        </Button>
      </div>
      <ClashDialog
        clashes={clashes}
        title="This leave overlaps bookings"
        description="Add the leave anyway? The bookings below stay on the calendar until you move them."
        busy={busy}
        onCancel={() => setClashes(null)}
        onConfirm={() => add(true)}
      />
    </Section>
  );
}
