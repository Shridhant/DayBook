"use client";

import { CalendarClock, ChevronRight, IndianRupee, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { OptionCard, SlotChip } from "@/components/ui/choice";
import { Switch } from "@/components/ui/toggle";
import { MAX_CUSTOMER_RESCHEDULES } from "@/lib/customer-changes";
import { formatINR, paiseToRupeesInput, rupeesToPaise } from "@/lib/money";
import { bookingAmount } from "@/lib/pricing";
import { formatDuration, formatTime, timeToMinutes } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { AdminSettings } from "@/server/admin/settings-admin";
import { adminFetch, useMutation } from "./admin-kit";

type Hours = AdminSettings["hours"];
type CalendarRule = "slotIntervalMin" | "bookingWindowDays" | "leadTimeMin" | "holdMinutes";
type Panel = "amount" | "cancel" | "hours" | CalendarRule;

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const EXAMPLE_TOTALS = [80000, 123400, 350000];

/**
 * Settings as a read-only overview: every row states the current value in plain words, and
 * editing happens in a focused dialog with its own Save. The API saves all booking rules at
 * once, so each dialog sends the saved values plus its own changes.
 */
export function SettingsForm({ settings }: { settings: AdminSettings }) {
  const [panel, setPanel] = useState<Panel | null>(null);
  // Remounts the dialog body on every open, so an abandoned edit never lingers.
  const [session, setSession] = useState(0);
  const open = (p: Panel) => {
    setSession((s) => s + 1);
    setPanel(p);
  };
  const close = () => setPanel(null);
  const dialog = (p: Panel) => ({ open: panel === p, onOpenChange: (o: boolean) => !o && close() });

  return (
    <div className="mx-auto max-w-3xl">
      <Section icon={IndianRupee} title="Payments and cancellations" className="overflow-hidden">
        <Rows>
          <Row label="Pay to book" hint="Paid online to confirm a booking" value={amountSummary(settings)} onClick={() => open("amount")} />
          <Row label="Free cancellation" hint="Refund and reschedule allowed until" value={cancelSummary(settings.cancelWindowHours)} onClick={() => open("cancel")} />
        </Rows>
      </Section>

      <Section icon={CalendarClock} title="Booking calendar" className="overflow-hidden">
        <Rows>
          <Row label="Opening hours" hint="Shown on the website" value={<HoursSummary hours={settings.hours} />} onClick={() => open("hours")} />
          {CALENDAR_RULES.map((rule) => (
            <Row key={rule.key} label={rule.title} hint={rule.hint} value={rule.summary(settings[rule.key])} onClick={() => open(rule.key)} />
          ))}
        </Rows>
      </Section>

      <Section icon={ShieldCheck} title="Privacy" className="overflow-hidden">
        <Rows>
          <PhoneToggle settings={settings} />
        </Rows>
      </Section>

      <Dialog {...dialog("amount")}>
        <AmountDialog key={session} settings={settings} onDone={close} />
      </Dialog>
      <Dialog {...dialog("cancel")}>
        <CancelDialog key={session} settings={settings} onDone={close} />
      </Dialog>
      {CALENDAR_RULES.map((rule) => (
        <Dialog key={rule.key} {...dialog(rule.key)}>
          <RuleDialog key={session} rule={rule} settings={settings} onDone={close} />
        </Dialog>
      ))}
      <Dialog {...dialog("hours")}>
        <HoursDialog key={session} hours={settings.hours} onDone={close} />
      </Dialog>
    </div>
  );
}

/* ---------- Overview rows ---------- */

function Rows({ children }: { children: ReactNode }) {
  return <div className="-mx-5 -mb-5 divide-y divide-line border-t border-line">{children}</div>;
}

function Row({ label, hint, value, onClick }: { label: string; hint?: string; value: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-150 outline-none hover:bg-hover focus-visible:bg-hover"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
        <span className="sm:w-48 sm:shrink-0">
          <span className="block font-medium">{label}</span>
          {hint && <span className="block text-xs text-muted">{hint}</span>}
        </span>
        <span className="min-w-0 flex-1 text-muted sm:text-right">{value}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
    </button>
  );
}

function PhoneToggle({ settings }: { settings: AdminSettings }) {
  const { run, busy } = useMutation();
  const [on, setOn] = useState(settings.showCustomerPhoneToStaff);
  const change = async (next: boolean) => {
    setOn(next);
    const ok = await run(() => saveRules(settings, { showCustomerPhoneToStaff: next }), next ? "Artists can now see phone numbers" : "Phone numbers hidden from artists");
    if (!ok) setOn(!next);
  };
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 px-5 py-3">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Show customers&apos; phone numbers to artists</span>
        <span className="block text-xs text-muted">In the artist portal. Off means artists see only names.</span>
      </span>
      <Switch checked={on} disabled={busy} onCheckedChange={change} />
    </label>
  );
}

function HoursSummary({ hours }: { hours: Hours }) {
  return (
    <span className="flex flex-col gap-0.5">
      {groupHours(hours).map((g) => (
        <span key={g.days}>
          <span className="text-ink">{g.days}</span> · {g.time}
        </span>
      ))}
    </span>
  );
}

/* ---------- Edit dialogs ---------- */

function EditDialog({
  title,
  description,
  busy,
  canSave,
  onSave,
  onDone,
  children,
}: {
  title: string;
  description: string;
  busy: boolean;
  canSave: boolean;
  onSave: () => void;
  onDone: () => void;
  children: ReactNode;
}) {
  return (
    <DialogContent
      title={title}
      description={description}
      footer={
        <>
          <Button size="md" onClick={onDone} disabled={busy}>
            Cancel
          </Button>
          <Button size="md" variant="primary" loading={busy} disabled={!canSave} onClick={onSave}>
            Save
          </Button>
        </>
      }
    >
      {children}
    </DialogContent>
  );
}

function AmountDialog({ settings, onDone }: { settings: AdminSettings; onDone: () => void }) {
  const { run, busy } = useMutation();
  const [type, setType] = useState(settings.bookingAmountType);
  const [fixed, setFixed] = useState(paiseToRupeesInput(settings.bookingAmountFixedPaise));
  const [percent, setPercent] = useState(String(settings.bookingAmountPercent));

  const fixedPaise = rupeesToPaise(fixed);
  const percentNum = Number(percent);
  const percentOk = percent.trim() !== "" && Number.isInteger(percentNum) && percentNum >= 0 && percentNum <= 100;
  const valid = type === "fixed" ? fixedPaise !== null : percentOk;
  const changed =
    type !== settings.bookingAmountType ||
    (type === "fixed" ? fixedPaise !== settings.bookingAmountFixedPaise : percentNum !== settings.bookingAmountPercent);
  const rule = type === "fixed" ? { type: "fixed" as const, fixedPaise: fixedPaise ?? 0 } : { type: "percent" as const, percent: percentOk ? percentNum : 0 };

  const save = async () => {
    const patch: Partial<AdminSettings> = { bookingAmountType: type };
    if (type === "fixed" && fixedPaise !== null) patch.bookingAmountFixedPaise = fixedPaise;
    if (type === "percent") patch.bookingAmountPercent = percentNum;
    if (await run(() => saveRules(settings, patch), "Booking amount saved")) onDone();
  };

  return (
    <EditDialog
      title="Pay to book"
      description="What customers pay online to confirm. The rest is paid at the salon."
      busy={busy}
      canSave={valid && changed}
      onSave={save}
      onDone={onDone}
    >
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Booking amount type">
        <OptionCard selected={type === "fixed"} onClick={() => setType("fixed")}>
          <span>
            <span className="block font-medium">Fixed amount</span>
            <span className="block text-xs text-muted">Same for every booking</span>
          </span>
        </OptionCard>
        <OptionCard selected={type === "percent"} onClick={() => setType("percent")}>
          <span>
            <span className="block font-medium">Percentage</span>
            <span className="block text-xs text-muted">A share of the total</span>
          </span>
        </OptionCard>
      </div>

      {type === "fixed" ? (
        <Field label="Amount" hint="₹0 means customers book without paying online" error={fixedPaise === null ? "Enter an amount, like 500" : undefined}>
          <Input prefix="₹" inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value)} />
        </Field>
      ) : (
        <Field label="Percentage of the total" hint="Rounded to the nearest ₹10, so UPI amounts look tidy" error={percentOk ? undefined : "Enter a whole number from 0 to 100"}>
          <Input prefix="%" type="number" inputMode="numeric" min={0} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} />
        </Field>
      )}

      <div className="rounded-xl bg-hover p-3">
        <p className="text-xs font-medium text-muted">Customers pay now</p>
        <dl className="mt-2 grid grid-cols-3 gap-2">
          {EXAMPLE_TOTALS.map((total) => (
            <div key={total}>
              <dt className="text-xs text-muted">on {formatINR(total)}</dt>
              <dd className="font-medium tabular-nums">{formatINR(bookingAmount([{ pricePaise: total, bookingAmountOverridePaise: null }], rule))}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="text-xs text-muted">
        A service can have its own booking amount (Services &amp; prices). Bookings already made keep the amount they were booked with.
      </p>
    </EditDialog>
  );
}

function CancelDialog({ settings, onDone }: { settings: AdminSettings; onDone: () => void }) {
  const { run, busy } = useMutation();
  const [hours, setHours] = useState(settings.cancelWindowHours);
  const save = async () => {
    if (await run(() => saveRules(settings, { cancelWindowHours: hours }), "Cancellation window saved")) onDone();
  };

  return (
    <EditDialog
      title="Free cancellation"
      description="How close to the appointment customers can still cancel with a refund, or move it."
      busy={busy}
      canSave={hours !== settings.cancelWindowHours}
      onSave={save}
      onDone={onDone}
    >
      <Field label="Free until">
        <NativeSelect value={hours} onChange={(e) => setHours(Number(e.target.value))}>
          {withCurrent([0, 2, 4, 6, 12, 24, 48, 72], settings.cancelWindowHours).map((h) => (
            <option key={h} value={h}>
              {h === 0 ? "The appointment starts" : `${plural(h, "hour")} before`}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <ul className="space-y-2 rounded-xl bg-hover p-3 text-[13px]">
        {hours === 0 ? (
          <li>Customers can cancel with a refund, or reschedule, any time before the appointment.</li>
        ) : (
          <>
            <li>
              <span className="font-medium">More than {plural(hours, "hour")} before:</span> cancelling refunds the booking amount automatically, and they can
              reschedule up to {MAX_CUSTOMER_RESCHEDULES} times.
            </li>
            <li>
              <span className="font-medium">Closer than that:</span> they can still cancel, but the booking amount is kept.
            </li>
          </>
        )}
      </ul>
      <p className="text-xs text-muted">Keep the cancellation policy page in line with this.</p>
    </EditDialog>
  );
}

/* The four calendar rules: one setting per row and per dialog, picked from presets. */

type RuleSpec = {
  key: CalendarRule;
  title: string;
  hint: string;
  description: string;
  presets: number[];
  option: (n: number) => string;
  summary: (n: number) => string;
  /** What the chosen value means for a customer, in one concrete sentence. */
  example: (n: number, settings: AdminSettings) => string;
  /** How the rule treats front-desk bookings (server/availability-query.ts `forAdmin`). */
  note: string;
};

const CALENDAR_RULES: RuleSpec[] = [
  {
    key: "slotIntervalMin",
    title: "Time slots",
    hint: "How often start times are offered",
    description: "How far apart the start times customers can pick are.",
    presets: [5, 10, 15, 20, 30, 60],
    option: (n) => `${n} min`,
    summary: (n) => `Every ${n} min`,
    example: (n, s) => {
      const open = timeToMinutes(firstOpenDay(s.hours)?.opensAt ?? "11:00");
      return `Customers see start times like ${[0, 1, 2, 3].map((i) => formatTime(open + i * n)).join(", ")}…`;
    },
    note: "Front-desk bookings use the same start times.",
  },
  {
    key: "bookingWindowDays",
    title: "Book ahead",
    hint: "Furthest date in the calendar",
    description: "How far into the future customers can book online.",
    presets: [7, 14, 21, 30, 45, 60, 90, 120, 180],
    option: (n) => plural(n, "day"),
    summary: (n) => `Up to ${plural(n, "day")}`,
    example: (n) => (n === 1 ? "Customers can only book for today." : `The booking calendar shows today and the next ${plural(n - 1, "day")}.`),
    note: "The front desk can book further ahead.",
  },
  {
    key: "leadTimeMin",
    title: "Online notice",
    hint: "Earliest start time from now",
    description: "How much warning you get before an online booking starts.",
    presets: [0, 15, 30, 60, 120, 180, 240, 360, 720, 1440],
    option: (n) => (n === 0 ? "None" : formatDuration(n)),
    summary: noticeLabel,
    example: (n) => {
      if (n === 0) return "A free slot can be booked right up to its start time.";
      const t = 14 * 60 + n;
      return `At 2:00 pm, the earliest time offered is ${t >= 1440 ? `tomorrow at ${formatTime(t - 1440)}` : formatTime(t)}.`;
    },
    note: "The front desk can book a slot starting right away.",
  },
  {
    key: "holdMinutes",
    title: "Payment hold",
    hint: "Slot kept while the customer pays",
    description: "How long a chosen slot is reserved while the customer pays online.",
    presets: [5, 10, 15, 20, 30, 45, 60],
    option: (n) => `${n} min`,
    summary: (n) => `${n} min`,
    example: (n) => `Nobody else can take the slot for ${n} minutes; if the customer hasn't paid by then, it's released.`,
    note: "Front-desk bookings are confirmed straight away, with no hold.",
  },
];

function RuleDialog({ rule, settings, onDone }: { rule: RuleSpec; settings: AdminSettings; onDone: () => void }) {
  const { run, busy } = useMutation();
  const saved = settings[rule.key];
  const [value, setValue] = useState(saved);
  const save = async () => {
    if (await run(() => saveRules(settings, { [rule.key]: value }), `${rule.title} saved`)) onDone();
  };

  return (
    <EditDialog title={rule.title} description={rule.description} busy={busy} canSave={value !== saved} onSave={save} onDone={onDone}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-label={rule.title}>
        {withCurrent(rule.presets, saved).map((n) => (
          <SlotChip key={n} selected={n === value} onClick={() => setValue(n)} className="h-10 text-[13px]">
            {rule.option(n)}
          </SlotChip>
        ))}
      </div>
      <p className="rounded-xl bg-hover p-3 text-[13px]">{rule.example(value, settings)}</p>
      <p className="text-xs text-muted">{rule.note}</p>
    </EditDialog>
  );
}

function HoursDialog({ hours: saved, onDone }: { hours: Hours; onDone: () => void }) {
  const { run, busy } = useMutation();
  const [hours, setHours] = useState(saved);
  const update = (weekday: number, patch: Partial<Hours[number]>) => setHours((h) => h.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));

  const invalid = new Set(hours.filter((d) => d.open && timeToMinutes(d.closesAt) <= timeToMinutes(d.opensAt)).map((d) => d.weekday));
  const changed = JSON.stringify(hours) !== JSON.stringify(saved);
  const first = WEEK.map((w) => hours.find((d) => d.weekday === w)).find((d) => d?.open);
  const copyFirst = () => first && setHours((h) => h.map((d) => (d.open ? { ...d, opensAt: first.opensAt, closesAt: first.closesAt } : d)));

  const save = async () => {
    if (await run(() => adminFetch("/api/admin/settings/hours", { method: "PUT", body: { hours } }), "Opening hours saved")) onDone();
  };

  return (
    <EditDialog
      title="Opening hours"
      description="Shown on the website. Artists' shifts must fit inside these hours to be bookable."
      busy={busy}
      canSave={changed && invalid.size === 0}
      onSave={save}
      onDone={onDone}
    >
      <div className="divide-y divide-line">
        {WEEK.map((weekday) => {
          const d = hours.find((x) => x.weekday === weekday);
          if (!d) return null;
          return (
            <div key={weekday} className="py-2.5 first:pt-0">
              <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
                <label className="flex w-32 cursor-pointer items-center gap-2">
                  <Switch checked={d.open} onCheckedChange={(open) => update(weekday, { open })} aria-label={`Open on ${DAY[weekday]}`} />
                  <span className={cn(d.open ? "font-medium" : "text-muted")}>{DAY[weekday]}</span>
                </label>
                {d.open ? (
                  <div className="flex items-center gap-1.5">
                    <Input type="time" step={300} className="w-28" value={d.opensAt} aria-label={`${DAY[weekday]} opens`} onChange={(e) => update(weekday, { opensAt: e.target.value })} />
                    <span className="text-muted">to</span>
                    <Input type="time" step={300} className="w-28" value={d.closesAt} aria-label={`${DAY[weekday]} closes`} onChange={(e) => update(weekday, { closesAt: e.target.value })} />
                  </div>
                ) : (
                  <span className="text-muted">Closed</span>
                )}
              </div>
              {invalid.has(weekday) && (
                <p role="alert" className="mt-1 text-xs text-danger">
                  Closing time must be after opening time.
                </p>
              )}
            </div>
          );
        })}
      </div>
      {first && (
        <Button size="sm" onClick={copyFirst}>
          Use {DAY[first.weekday]}&apos;s hours on every open day
        </Button>
      )}
      <p className="text-xs text-muted">For a single day off (a holiday), add it under Closures instead.</p>
    </EditDialog>
  );
}

/* ---------- Helpers ---------- */

function saveRules(saved: AdminSettings, patch: Partial<AdminSettings>) {
  const s = { ...saved, ...patch };
  return adminFetch("/api/admin/settings", {
    method: "PUT",
    body: {
      bookingAmountType: s.bookingAmountType,
      bookingAmountFixed: paiseToRupeesInput(s.bookingAmountFixedPaise),
      bookingAmountPercent: s.bookingAmountPercent,
      cancelWindowHours: s.cancelWindowHours,
      slotIntervalMin: s.slotIntervalMin,
      bookingWindowDays: s.bookingWindowDays,
      leadTimeMin: s.leadTimeMin,
      holdMinutes: s.holdMinutes,
      showCustomerPhoneToStaff: s.showCustomerPhoneToStaff,
    },
  });
}

function amountSummary(s: AdminSettings): string {
  if (s.bookingAmountType === "percent") return s.bookingAmountPercent === 0 ? "Nothing online" : `${s.bookingAmountPercent}% of the total`;
  return s.bookingAmountFixedPaise === 0 ? "Nothing online" : `${formatINR(s.bookingAmountFixedPaise)} per booking`;
}

function cancelSummary(hours: number): string {
  return hours === 0 ? "Until the appointment starts" : `${plural(hours, "hour")} before`;
}

function noticeLabel(minutes: number): string {
  return minutes === 0 ? "No notice needed" : `At least ${formatDuration(minutes)} ahead`;
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** Preset options plus the saved value, so an unusual saved value still shows and stays selected. */
function withCurrent(presets: number[], current: number): number[] {
  return presets.includes(current) ? presets : [...presets, current].sort((a, b) => a - b);
}

function firstOpenDay(hours: Hours) {
  return WEEK.map((w) => hours.find((d) => d.weekday === w)).find((d) => d?.open);
}

/** Consecutive days (Mon → Sun) with the same hours, e.g. "Mon–Sat · 11:00 am – 8:00 pm". */
function groupHours(hours: Hours): { days: string; time: string }[] {
  const label = (d: Hours[number]) => (d.open ? `${formatTime(timeToMinutes(d.opensAt))} – ${formatTime(timeToMinutes(d.closesAt))}` : "Closed");
  const groups: { from: number; to: number; time: string }[] = [];
  for (const weekday of WEEK) {
    const d = hours.find((x) => x.weekday === weekday);
    if (!d) continue;
    const time = label(d);
    const last = groups.at(-1);
    if (last && last.time === time) last.to = weekday;
    else groups.push({ from: weekday, to: weekday, time });
  }
  return groups.map((g) => ({ days: g.from === g.to ? DAY_SHORT[g.from] : `${DAY_SHORT[g.from]}–${DAY_SHORT[g.to]}`, time: g.time }));
}
