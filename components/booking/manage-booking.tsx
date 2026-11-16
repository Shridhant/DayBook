"use client";

import { CalendarClock, MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Code } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/choice";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Eyebrow } from "@/components/ui/page-section";
import { formatINR } from "@/lib/money";
import { formatDate, formatDuration, formatInstantTime, formatTime, toIst } from "@/lib/time";
import { whatsappLink } from "@/lib/site";
import type { Catalog } from "@/server/catalog";
import type { CancelResult, ManagedBooking } from "@/server/manage-booking";
import { ApiError, cancelManagedBooking, fetchManageAvailability, rescheduleManagedBooking, type SlotDto } from "./api";
import { TimeStep } from "./step-time";

const at = (iso: string) => {
  const d = new Date(iso);
  return `${formatDate(toIst(d).date)}, ${formatInstantTime(d)}`;
};

const HEADLINE: Record<ManagedBooking["status"], (b: ManagedBooking) => string> = {
  confirmed: (b) => `See you on ${formatDate(toIst(new Date(b.startsAt)).date)}`,
  pending: () => "Waiting for your payment",
  completed: () => "Thanks for visiting",
  no_show: () => "We missed you",
  cancelled: () => "This booking is cancelled",
  expired: () => "This booking wasn't completed",
};

/** One sentence on what the customer can still do, following the cancellation policy. */
function policyLine(b: ManagedBooking): string | null {
  const { actions } = b;
  if (actions.reschedule) return `You can change the time or cancel for free until ${at(b.freeUntil)}.`;
  if (b.free && actions.cancel) return `You can cancel for free until ${at(b.freeUntil)}. To move it again, please contact us.`;
  if (actions.cancel && b.paidPaise > 0) {
    return `It's within ${b.cancelWindowHours} hours of your appointment, so the ${formatINR(b.paidPaise)} booking amount isn't refundable if you cancel now.`;
  }
  if (actions.cancel) return "Can't make it? Please cancel so someone else can have the slot.";
  return null;
}

/** What happened to the money after a cancellation, in the customer's words. */
function refundMessage(result: CancelResult["refund"]): string | null {
  if (!result) return null;
  switch (result.status) {
    case "started":
      return `${formatINR(result.amountPaise)} is on its way back to the account you paid with. Banks usually take 5–7 working days.`;
    case "pending_owner":
      return `We'll refund ${formatINR(result.amountPaise)} to the account you paid with within 2 working days.`;
    case "not_refundable":
      return `As it was within the cancellation window, the ${formatINR(result.amountPaise)} booking amount isn't refunded.`;
  }
}

export function ManageBooking({ booking, manageKey, catalog }: { booking: ManagedBooking; manageKey: string; catalog: Catalog }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const minutes = booking.items.reduce((s, i) => s + i.durationMin, 0);
  const dueAtStudio = Math.max(0, booking.totalPaise - booking.paidPaise);
  const whatsapp = whatsappLink(`Hi! About my booking ${booking.code} on ${at(booking.startsAt)}.`);
  const { actions } = booking;

  async function cancel() {
    try {
      const result = await cancelManagedBooking({ code: booking.code, key: manageKey });
      setNotice({ tone: "success", text: ["Your booking is cancelled.", refundMessage(result.refund)].filter(Boolean).join(" ") });
      router.refresh();
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof ApiError ? error.message : "Couldn't cancel. Nothing was changed; please try again." });
    }
  }

  if (mode === "reschedule") {
    return (
      <Reschedule
        booking={booking}
        manageKey={manageKey}
        catalog={catalog}
        onDone={(text) => {
          setMode("view");
          setNotice({ tone: "success", text });
          router.refresh();
        }}
        onBack={() => setMode("view")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <Eyebrow>Your booking</Eyebrow>
      <h1 className="mt-3 text-[clamp(1.75rem,5vw,2.25rem)] leading-[1.15] font-semibold tracking-[-0.025em]">{HEADLINE[booking.status](booking)}</h1>

      {notice && (
        <Alert tone={notice.tone} className="mt-6">
          {notice.text}
        </Alert>
      )}

      <div className="card mt-6 p-5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[14px] text-muted">Booking reference</span>
          <Code className="text-[15px]">{booking.code}</Code>
        </div>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[15px]">
          <Row label="When" value={`${at(booking.startsAt)} – ${formatInstantTime(new Date(booking.endsAt))}`} />
          <Row label="Artist" value={booking.staff.name} />
          <Row label="Services" value={`${booking.items.map((i) => i.name).join(", ")} · ${formatDuration(minutes)}`} />
          <Row label="Total" value={formatINR(booking.totalPaise)} />
          {booking.paidPaise > 0 && <Row label="Paid online" value={formatINR(booking.paidPaise)} />}
          {booking.refundedPaise > 0 && <Row label="Refunded" value={formatINR(booking.refundedPaise)} />}
          {booking.status === "confirmed" && <Row label="Pay at the studio" value={formatINR(dueAtStudio)} />}
        </dl>
      </div>

      {booking.status === "confirmed" && (
        <p className="mt-5 text-[15px] text-muted">
          {policyLine(booking)}{" "}
          <Link href="/cancellation-policy" className="underline decoration-brand/40 underline-offset-4 hover:decoration-brand">
            Cancellation policy
          </Link>
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {actions.reschedule && (
          <Button variant="primary" size="pub-md" onClick={() => setMode("reschedule")}>
            <CalendarClock /> Change time
          </Button>
        )}
        {whatsapp && (
          <Button asChild size="pub-md">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> WhatsApp us
            </a>
          </Button>
        )}
        {actions.cancel && (
          <Button variant="ghost" size="pub-md" className="text-danger hover:bg-danger/10" onClick={() => setCancelOpen(true)}>
            <X /> Cancel booking
          </Button>
        )}
      </div>

      {(booking.status === "cancelled" || booking.status === "completed" || booking.status === "expired") && (
        <Button asChild variant="primary" size="pub-md" className="mt-6">
          <Link href="/book">Book again</Link>
        </Button>
      )}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this booking?"
        description={
          actions.refundOnCancel
            ? `${at(booking.startsAt)} with ${booking.staff.name}. The ${formatINR(booking.paidPaise)} you paid online will be refunded.`
            : booking.paidPaise > 0
              ? `${at(booking.startsAt)} with ${booking.staff.name}. It's within ${booking.cancelWindowHours} hours, so the ${formatINR(booking.paidPaise)} booking amount won't be refunded.`
              : `${at(booking.startsAt)} with ${booking.staff.name}.`
        }
        confirmLabel="Cancel booking"
        cancelLabel="Keep it"
        tone="danger"
        onConfirm={cancel}
      />
    </div>
  );
}

function Reschedule({
  booking,
  manageKey,
  catalog,
  onDone,
  onBack,
}: {
  booking: ManagedBooking;
  manageKey: string;
  catalog: Catalog;
  onDone: (message: string) => void;
  onBack: () => void;
}) {
  const [anyArtist, setAnyArtist] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotDto | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const serviceIds = booking.items.map((i) => i.serviceId);

  async function confirm() {
    if (!date || !slot) return;
    setBusy(true);
    try {
      const { booking: moved } = await rescheduleManagedBooking({ code: booking.code, key: manageKey, date, startMinutes: slot.minutes, anyArtist });
      onDone(`Done! Your new time is ${at(moved.startsAt)} with ${moved.staff.name}. We've emailed you an updated calendar invite if you gave us your email.`);
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : "Couldn't change the time. Nothing was changed; please try again.");
      setSlot(null);
      setRefreshKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl min-w-0">
      <Button variant="ghost" size="pub-sm" onClick={onBack} className="-ml-3">
        ← Back to your booking
      </Button>
      <p className="mt-4 text-[15px] text-muted">
        Currently {at(booking.startsAt)} with {booking.staff.name}. Same services and price.
      </p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Artist">
        <FilterChip selected={!anyArtist} onClick={() => { setAnyArtist(false); setSlot(null); }}>
          Only {booking.staff.name}
        </FilterChip>
        <FilterChip selected={anyArtist} onClick={() => { setAnyArtist(true); setSlot(null); }}>
          Any artist
        </FilterChip>
      </div>

      <div className="mt-6">
        <TimeStep
          catalog={catalog}
          serviceIds={serviceIds}
          staffId={anyArtist ? null : booking.staff.id}
          date={date}
          slotMinutes={slot?.minutes ?? null}
          refreshKey={refreshKey}
          notice={notice}
          title="Pick a new time"
          fetcher={({ date: d }, signal) => fetchManageAvailability({ code: booking.code, key: manageKey, date: d, anyArtist }, signal)}
          onDate={(d) => {
            setDate(d);
            setSlot(null);
          }}
          onPick={(d, s) => {
            setDate(d);
            setSlot(s);
            setNotice(null);
          }}
        />
      </div>

      {date && slot && (
        <div className="sticky bottom-0 -mx-4 mt-6 border-t border-line bg-surface/95 px-4 py-4 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
          <Button variant="primary" size="pub-lg" block loading={busy} onClick={confirm}>
            Move to {formatDate(date)}, {formatTime(slot.minutes)}
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
