"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/card";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Checkbox } from "@/components/ui/toggle";
import { formatINR } from "@/lib/money";
import { normalizeIndianMobile } from "@/lib/phone";
import { formatDate, formatDuration, formatTime, isDateKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { AdminBooking } from "@/server/admin/bookings";
import type { Catalog } from "@/server/catalog";
import { CalendarClock, Scissors, UserRound } from "lucide-react";

type Slot = { minutes: number; label: string; freeStaff: number };
type SlotsState = { key: string; slots?: Slot[]; closedReason?: string | null; error?: string };

const CLOSED_TEXT: Record<string, string> = {
  past: "That date has passed.",
  outside_window: "That date is too far ahead.",
  closed: "The studio is closed that day.",
  no_staff: "No artist does all of these services.",
};

export function NewBookingForm({ catalog, initialDate }: { catalog: Catalog; initialDate: string }) {
  const router = useRouter();
  const toast = useToast();
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [slot, setSlot] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<"walk_in" | "phone">("walk_in");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [slotsState, setSlotsState] = useState<SlotsState | null>(null);

  const chosen = serviceIds.flatMap((id) => catalog.services.find((s) => s.id === id) ?? []);
  const qualified = useMemo(
    () => catalog.staff.filter((s) => serviceIds.every((id) => s.serviceIds.includes(id))),
    [catalog.staff, serviceIds],
  );
  const effectiveStaff = qualified.some((s) => s.id === staffId) ? staffId : "";
  const total = chosen.reduce((sum, s) => sum + s.pricePaise, 0);
  const duration = chosen.reduce((sum, s) => sum + s.durationMin, 0);

  const slotsKey = serviceIds.length && isDateKey(date) ? JSON.stringify([date, serviceIds, effectiveStaff, refresh]) : null;
  useEffect(() => {
    if (!slotsKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ date, services: serviceIds.join(",") });
    if (effectiveStaff) params.set("staff", effectiveStaff);
    fetch(`/api/admin/availability?${params}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.message ?? "Couldn't load times.");
        setSlotsState({ key: slotsKey, slots: data.slots, closedReason: data.closedReason });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setSlotsState({ key: slotsKey, error: error instanceof Error ? error.message : "Couldn't load times." });
      });
    return () => controller.abort();
    // date/serviceIds/effectiveStaff/refresh are all captured in slotsKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsKey]);

  const loadingSlots = slotsKey !== null && slotsState?.key !== slotsKey;
  const current = slotsState?.key === slotsKey ? slotsState : null;

  function toggleService(id: string) {
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    setSlot(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: typeof errors = {};
    if (name.trim().length < 2) found.name = "Enter the customer's name";
    if (!normalizeIndianMobile(phone)) found.phone = "Enter a valid 10-digit Indian mobile number";
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length || slot === null || !serviceIds.length) return;

    setBusy(true);
    try {
      const response = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceIds,
          staffId: effectiveStaff || null,
          date,
          startMinutes: slot,
          customer: { name: name.trim(), phone },
          source,
          notes: notes.trim() || undefined,
        }),
      });
      const data = (await response.json().catch(() => null)) as { booking?: AdminBooking; message?: string; field?: string } | null;
      if (!response.ok || !data?.booking) {
        if (response.status === 409) {
          setSlot(null);
          setRefresh((r) => r + 1);
        }
        if (data?.field === "customer.name") setErrors({ name: data.message });
        else if (data?.field === "customer.phone") setErrors({ phone: data.message });
        else setFormError(data?.message ?? "Couldn't create the booking.");
        return;
      }
      toast({
        title: `Booked ${data.booking.code}`,
        description: `${data.booking.customer.name} with ${data.booking.staffName}, ${formatDate(data.booking.date)} ${formatTime(data.booking.startMin)}`,
        tone: "success",
      });
      router.push(`/admin/today?date=${data.booking.date}`);
      router.refresh();
    } catch {
      setFormError("You seem to be offline. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]" noValidate>
      <div className="min-w-0">
        <Section icon={Scissors} title="Services" description="Pick one or more; one artist does them back to back.">
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            {catalog.categories.map((category) => (
              <fieldset key={category.id}>
                <legend className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">{category.name}</legend>
                <ul className="space-y-1">
                  {catalog.services
                    .filter((s) => s.categoryId === category.id)
                    .map((s) => (
                      <li key={s.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-hover">
                          <Checkbox checked={serviceIds.includes(s.id)} onCheckedChange={() => toggleService(s.id)} />
                          <span className="min-w-0 flex-1 truncate">{s.name}</span>
                          <span className="text-xs text-muted tabular-nums">{formatDuration(s.durationMin)}</span>
                          <span className="w-16 text-right tabular-nums">{formatINR(s.pricePaise)}</span>
                        </label>
                      </li>
                    ))}
                </ul>
              </fieldset>
            ))}
          </div>
        </Section>

        <Section icon={CalendarClock} title="When">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Artist">
              <NativeSelect
                value={effectiveStaff}
                onChange={(e) => {
                  setStaffId(e.target.value);
                  setSlot(null);
                }}
                disabled={!serviceIds.length}
              >
                <option value="">Any available</option>
                {qualified.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSlot(null);
                }}
              />
            </Field>
          </div>

          <div className="mt-4 min-h-24" aria-live="polite">
            {!serviceIds.length ? (
              <p className="text-muted">Choose services to see free times.</p>
            ) : loadingSlots ? (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
                {Array.from({ length: 16 }, (_, i) => (
                  <Skeleton key={i} className="h-7" />
                ))}
              </div>
            ) : current?.error ? (
              <Alert size="app" tone="danger">
                {current.error}
              </Alert>
            ) : current?.closedReason ? (
              <p className="text-muted">{CLOSED_TEXT[current.closedReason] ?? "Not available."}</p>
            ) : !current?.slots?.length ? (
              <p className="text-muted">No free times on {isDateKey(date) ? formatDate(date) : "this day"}.</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8" role="group" aria-label="Start time">
                {current.slots.map((s) => (
                  <Button
                    key={s.minutes}
                    size="sm"
                    variant={slot === s.minutes ? "primary" : "secondary"}
                    aria-pressed={slot === s.minutes}
                    onClick={() => setSlot(s.minutes)}
                    className="justify-center tabular-nums"
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section icon={UserRound} title="Customer">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" error={errors.name}>
              <Input value={name} autoComplete="off" maxLength={60} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Mobile number" error={errors.phone} hint="Returning customers are matched by number">
              <Input value={phone} type="tel" inputMode="tel" autoComplete="off" maxLength={16} placeholder="98765 43210" onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <span className="label">Booked via</span>
              <Tabs
                label="Booked via"
                items={[
                  { value: "walk_in", label: "Walk-in" },
                  { value: "phone", label: "Phone" },
                ]}
                value={source}
                onValueChange={setSource}
              />
            </div>
            <Field label="Notes (optional)">
              <Textarea rows={2} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </Section>
      </div>

      <aside className="xl:sticky xl:top-4 xl:self-start">
        <div className="card p-5">
          <h2 className="text-[14px] font-semibold">Summary</h2>
          <dl className="mt-3 space-y-1.5">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Services</dt>
              <dd className="text-right">{chosen.length ? chosen.map((s) => s.name).join(", ") : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Duration</dt>
              <dd className="tabular-nums">{duration ? formatDuration(duration) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">When</dt>
              <dd className={cn("text-right", slot === null && "text-muted")}>
                {slot !== null && isDateKey(date) ? `${formatDate(date)}, ${formatTime(slot)}` : "Pick a time"}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-2 font-medium">
              <dt>Due at the studio</dt>
              <dd className="tabular-nums">{formatINR(total)}</dd>
            </div>
          </dl>
          {formError && (
            <Alert size="app" tone="danger" className="mt-3">
              {formError}
            </Alert>
          )}
          <Button type="submit" variant="primary" size="lg" block className="mt-4" loading={busy} disabled={!serviceIds.length || slot === null}>
            Create booking
          </Button>
          <p className="mt-2 text-center text-xs text-muted">Confirmed straight away. Nothing is charged online.</p>
        </div>
      </aside>
    </form>
  );
}
