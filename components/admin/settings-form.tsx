"use client";

import { Clock, IndianRupee, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/toggle";
import { formatINR, paiseToRupeesInput, rupeesToPaise } from "@/lib/money";
import { bookingAmount } from "@/lib/pricing";
import type { AdminSettings } from "@/server/admin/settings-admin";
import { adminFetch, useMutation } from "./admin-kit";

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export function SettingsForm({ settings }: { settings: AdminSettings }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="min-w-0">
        <BookingRules settings={settings} />
      </div>
      <div className="min-w-0">
        <OpeningHours settings={settings} />
      </div>
    </div>
  );
}

function BookingRules({ settings }: { settings: AdminSettings }) {
  const { run, busy } = useMutation();
  const [type, setType] = useState(settings.bookingAmountType);
  const [fixed, setFixed] = useState(paiseToRupeesInput(settings.bookingAmountFixedPaise));
  const [percent, setPercent] = useState(settings.bookingAmountPercent);
  const [cancelWindowHours, setCancelWindowHours] = useState(settings.cancelWindowHours);
  const [slotIntervalMin, setSlotIntervalMin] = useState(settings.slotIntervalMin);
  const [bookingWindowDays, setBookingWindowDays] = useState(settings.bookingWindowDays);
  const [leadTimeMin, setLeadTimeMin] = useState(settings.leadTimeMin);
  const [holdMinutes, setHoldMinutes] = useState(settings.holdMinutes);
  const [showPhone, setShowPhone] = useState(settings.showCustomerPhoneToStaff);

  // Live example using the real pricing rule, for a ₹1,234 booking with no service override.
  const exampleAmount = bookingAmount(
    [{ pricePaise: 123400, bookingAmountOverridePaise: null }],
    type === "fixed" ? { type: "fixed", fixedPaise: rupeesToPaise(fixed) ?? 0 } : { type: "percent", percent },
  );

  const save = () =>
    run(
      () =>
        adminFetch("/api/admin/settings", {
          method: "PUT",
          body: {
            bookingAmountType: type,
            bookingAmountFixed: fixed,
            bookingAmountPercent: percent,
            cancelWindowHours,
            slotIntervalMin,
            bookingWindowDays,
            leadTimeMin,
            holdMinutes,
            showCustomerPhoneToStaff: showPhone,
          },
        }),
      "Settings saved",
    );

  const num = (set: (n: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => set(Math.max(0, Math.floor(Number(e.target.value) || 0)));

  return (
    <>
      <Section icon={IndianRupee} title="Pay to book" description="What customers pay online to confirm. Services can override it.">
        <Tabs
          label="Booking amount type"
          items={[
            { value: "fixed", label: "Fixed amount" },
            { value: "percent", label: "Percentage" },
          ]}
          value={type}
          onValueChange={setType}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {type === "fixed" ? (
            <Field label="Amount (₹)" hint="₹0 means no online payment">
              <Input inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value)} />
            </Field>
          ) : (
            <Field label="Percentage of total" hint="Rounded to the nearest ₹10">
              <Input type="number" min={0} max={100} value={percent} onChange={num((n) => setPercent(Math.min(100, n)))} />
            </Field>
          )}
          <p className="self-end pb-1.5 text-muted">
            For a ₹1,234 booking, customers pay <span className="font-medium text-ink tabular-nums">{formatINR(exampleAmount)}</span> now.
          </p>
        </div>
      </Section>

      <Section icon={SlidersHorizontal} title="Booking rules">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Free cancellation up to (hours before)">
            <Input type="number" min={0} max={168} value={cancelWindowHours} onChange={num(setCancelWindowHours)} />
          </Field>
          <Field label="Time slots every">
            <NativeSelect value={slotIntervalMin} onChange={(e) => setSlotIntervalMin(Number(e.target.value))}>
              {[5, 10, 15, 20, 30, 60].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Book up to (days ahead)">
            <Input type="number" min={1} max={180} value={bookingWindowDays} onChange={num(setBookingWindowDays)} />
          </Field>
          <Field label="Online notice (minutes)" hint="Earliest online booking from now">
            <Input type="number" min={0} max={1440} step={15} value={leadTimeMin} onChange={num(setLeadTimeMin)} />
          </Field>
          <Field label="Hold slot while paying (minutes)">
            <Input type="number" min={5} max={60} value={holdMinutes} onChange={num(setHoldMinutes)} />
          </Field>
        </div>
      </Section>

      <Section icon={ShieldCheck} title="Privacy">
        <label className="flex items-center gap-2">
          <Switch checked={showPhone} onCheckedChange={setShowPhone} /> Artists can see customers&apos; phone numbers
        </label>
        <p className="mt-1 text-xs text-muted">Applies to the artist portal (coming in phase 2).</p>
      </Section>

      <div className="flex justify-end">
        <Button variant="primary" size="md" loading={busy} onClick={save}>
          Save settings
        </Button>
      </div>
    </>
  );
}

function OpeningHours({ settings }: { settings: AdminSettings }) {
  const { run, busy } = useMutation();
  const [hours, setHours] = useState(settings.hours);
  const update = (weekday: number, patch: Partial<AdminSettings["hours"][number]>) =>
    setHours((h) => h.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));

  return (
    <Section icon={Clock} title="Opening hours" description="Shown on the website. Artists' shifts must fit inside these hours to be bookable.">
      <div className="divide-y divide-line">
        {WEEK.map((weekday) => {
          const d = hours.find((x) => x.weekday === weekday);
          if (!d) return null;
          return (
            <div key={weekday} className="flex flex-wrap items-center gap-3 py-2">
              <label className="flex w-36 items-center gap-2">
                <Switch checked={d.open} onCheckedChange={(open) => update(weekday, { open })} />
                <span className={d.open ? "font-medium" : "text-muted"}>{DAY[weekday]}</span>
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
          );
        })}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" size="md" loading={busy} onClick={() => run(() => adminFetch("/api/admin/settings/hours", { method: "PUT", body: { hours } }), "Opening hours saved")}>
          Save hours
        </Button>
      </div>
    </Section>
  );
}
