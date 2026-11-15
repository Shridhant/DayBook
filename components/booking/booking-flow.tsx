"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { indianMobileSchema } from "@/lib/phone";
import { openCheckout } from "@/lib/razorpay-checkout";
import { site } from "@/lib/site";
import type { Catalog } from "@/server/catalog";
import { ApiError, createHold, startPayment, verifyPayment, type HoldDto, type SlotDto } from "./api";
import { Confirmation, type Outcome } from "./confirmation";
import { BookingProgress } from "./progress";
import { ArtistStep } from "./step-artist";
import { DetailsStep, type DetailErrors, type Details } from "./step-details";
import { PayStep, type PayError } from "./step-pay";
import { ServicesStep } from "./step-services";
import { TimeStep } from "./step-time";
import { SummaryBar, SummaryCard } from "./summary";

const HEADING_IDS = ["step-services", "step-artist", "step-time", "step-details", "step-pay"];
const CONTINUE_LABELS = ["Choose artist", "Choose time", "Your details", "Review & pay", null] as const;
const EMPTY_DETAILS: Details = { name: "", phone: "", email: "", notes: "" };

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(60, "That's a bit long"),
  phone: indianMobileSchema,
  email: z.union([z.literal(""), z.email("Enter a valid email, or leave it empty")]),
  notes: z.string().max(500, "Please keep notes under 500 characters"),
});

function validateDetails(details: Details): DetailErrors {
  const result = detailsSchema.safeParse({ ...details, email: details.email.trim() });
  if (result.success) return {};
  const errors: DetailErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof Details;
    errors[key] ??= issue.message;
  }
  return errors;
}

/** Reads ?service=slug[,slug]&staff=slug so landing-page links can preselect choices. */
function initialSelection(params: URLSearchParams, catalog: Catalog) {
  const slugs = (params.get("service") ?? "").split(",").filter(Boolean);
  const serviceIds = slugs.flatMap((slug) => catalog.services.find((s) => s.slug === slug)?.id ?? []);
  const staffId = catalog.staff.find((s) => s.slug === params.get("staff"))?.id ?? null;
  return { serviceIds, staffId };
}

export function BookingFlow({ catalog }: { catalog: Catalog }) {
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const [initial] = useState(() => initialSelection(params, catalog));

  const [step, setStep] = useState(initial.serviceIds.length > 0 ? 1 : 0);
  const [direction, setDirection] = useState(1);
  const [selected, setSelected] = useState<string[]>(initial.serviceIds);
  const [staffChoice, setStaffChoice] = useState<string | null>(initial.staffId);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotDto | null>(null);
  const [timeNotice, setTimeNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<DetailErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [hold, setHold] = useState<HoldDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<PayError | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const chosen = useMemo(
    () => selected.flatMap((id) => catalog.services.find((s) => s.id === id) ?? []),
    [selected, catalog.services],
  );
  const qualified = useMemo(
    () => catalog.staff.filter((s) => selected.every((id) => s.serviceIds.includes(id))),
    [selected, catalog.staff],
  );
  // A chosen artist who can't do the new service mix falls back to "Any available".
  const staffId = staffChoice && qualified.some((s) => s.id === staffChoice) ? staffChoice : null;
  const artistName = catalog.staff.find((s) => s.id === staffId)?.name ?? null;

  // Move focus to the new step's heading (screen readers) and scroll to the top on step change.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    const id = outcome ? "confirmation-title" : HEADING_IDS[step];
    const timer = setTimeout(() => document.getElementById(id)?.focus({ preventScroll: true }), 250);
    return () => clearTimeout(timer);
  }, [step, outcome, reduce]);

  function go(next: number) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  /** Any change before payment invalidates the hold; the next hold replaces it server-side. */
  function clearFrom(level: "slot" | "hold") {
    if (level === "slot") setSlot(null);
    setHold(null);
    setPayError(null);
  }

  function toggleService(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    clearFrom("slot");
  }

  async function placeHold() {
    const found = validateDetails(details);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0 || !date || !slot) return;

    setBusy(true);
    try {
      const created = await createHold({
        serviceIds: selected,
        staffId,
        date,
        startMinutes: slot.minutes,
        customer: { name: details.name.trim(), phone: details.phone, email: details.email.trim() },
        notes: details.notes.trim(),
      });
      setHold(created);
      setPayError(null);
      go(4);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setTimeNotice(error.message);
        setSlot(null);
        setRefreshKey((k) => k + 1);
        go(2);
      } else if (error instanceof ApiError && error.field?.startsWith("customer.")) {
        const key = error.field.slice("customer.".length) as keyof Details;
        setErrors({ [key]: error.message });
      } else {
        setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!hold) return;
    setBusy(true);
    setPayError(null);
    let paid = false;
    try {
      const start = await startPayment(hold.bookingId);
      if (start.kind === "confirmed") {
        setOutcome("confirmed");
        return;
      }
      const result = await openCheckout({
        keyId: start.keyId,
        orderId: start.orderId,
        amountPaise: start.amountPaise,
        name: site.name,
        description: `Booking ${start.code}`,
        prefill: start.prefill,
      });
      if (result.kind === "dismissed") {
        if (result.lastError) setPayError({ tone: "danger", message: `${result.lastError} No money was taken. You can try again.` });
        return;
      }
      paid = true;
      const verified = await verifyPayment(result);
      if (verified.status === "confirmed" || verified.status === "already_confirmed") setOutcome("confirmed");
      else if (verified.status === "needs_review") setOutcome("needs_review");
      else if (verified.status === "failed") setPayError({ tone: "danger", message: verified.message });
      else setOutcome("processing");
    } catch (error) {
      if (paid) {
        // Money has moved; never tell the customer it failed. The webhook will confirm the booking.
        setOutcome("processing");
      } else if (error instanceof ApiError && error.code === "hold_expired") {
        setPayError({ tone: "warning", message: error.message, action: "pick_time" });
      } else if (error instanceof ApiError && error.status === 503) {
        setPayError({
          tone: "warning",
          message: "Online payments aren't available right now. Your slot is held for a few minutes; please call or WhatsApp the studio to confirm.",
        });
      } else {
        setPayError({
          tone: "danger",
          message: `${error instanceof Error ? error.message : "Couldn't start the payment."} No money was taken.`,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  function backToTime() {
    setTimeNotice(null);
    clearFrom("slot");
    setRefreshKey((k) => k + 1);
    go(2);
  }

  function reset() {
    setSelected([]);
    setStaffChoice(null);
    setDate(null);
    setSlot(null);
    setDetails((d) => ({ ...EMPTY_DETAILS, name: d.name, phone: d.phone, email: d.email }));
    setHold(null);
    setOutcome(null);
    setPayError(null);
    setTimeNotice(null);
    go(0);
  }

  const canContinue = [chosen.length > 0, qualified.length > 0, slot !== null, true, false][step];
  const onContinue = () => (step === 3 ? placeHold() : canContinue && go(step + 1));
  const summary = {
    services: chosen,
    artistName,
    date: slot ? date : null,
    slotMinutes: slot?.minutes ?? null,
    continueLabel: outcome ? null : CONTINUE_LABELS[step],
    canContinue,
    busy: busy && step === 3,
    onContinue,
  };

  const variants = {
    enter: (dir: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: 12 * dir }),
    center: { opacity: 1, x: 0, transition: { duration: reduce ? 0 : 0.22, ease: "easeOut" as const } },
    exit: (dir: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: -12 * dir, transition: { duration: 0.14 } }),
  };

  if (outcome && hold) {
    return (
      <div className="container-page pt-8 pb-16">
        <Confirmation outcome={outcome} hold={hold} onBookAnother={reset} />
      </div>
    );
  }

  return (
    <div className="container-page pt-6 pb-36 lg:pb-16">
      <BookingProgress step={step} onJump={go} />

      <div className="mt-8 lg:grid lg:grid-cols-12 lg:gap-10">
        <div className="min-w-0 lg:col-span-7">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div key={step} custom={direction} variants={variants} initial="enter" animate="center" exit="exit">
              {step === 0 && <ServicesStep catalog={catalog} selected={selected} onToggle={toggleService} />}
              {step === 1 && (
                <ArtistStep
                  qualified={qualified}
                  staffId={staffId}
                  onSelect={(id) => {
                    setStaffChoice(id);
                    clearFrom("slot");
                  }}
                />
              )}
              {step === 2 && (
                <TimeStep
                  catalog={catalog}
                  serviceIds={selected}
                  staffId={staffId}
                  date={date}
                  slotMinutes={slot?.minutes ?? null}
                  refreshKey={refreshKey}
                  notice={timeNotice}
                  onDate={(d) => {
                    setDate(d);
                    clearFrom("slot");
                  }}
                  onPick={(d, s) => {
                    setDate(d);
                    setSlot(s);
                    setTimeNotice(null);
                    clearFrom("hold");
                  }}
                />
              )}
              {step === 3 && (
                <>
                  <DetailsStep
                    details={details}
                    errors={errors}
                    onChange={(patch) => {
                      setDetails((d) => ({ ...d, ...patch }));
                      setErrors((e) => {
                        const next = { ...e };
                        for (const key of Object.keys(patch)) delete next[key as keyof Details];
                        return next;
                      });
                      clearFrom("hold");
                    }}
                  />
                  {formError && (
                    <Alert tone="danger" className="mt-4 max-w-xl">
                      {formError}
                    </Alert>
                  )}
                </>
              )}
              {step === 4 && hold && (
                <PayStep
                  hold={hold}
                  cancelWindowHours={catalog.cancelWindowHours}
                  busy={busy}
                  error={payError}
                  onPay={pay}
                  onPickTime={backToTime}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="lg:col-span-5">
          <SummaryCard {...summary} />
        </div>
      </div>

      <SummaryBar {...summary} />
    </div>
  );
}
