"use client";

import { CalendarPlus, Check, Hourglass, MessageCircle, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/badge";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { ICON_SPRING } from "@/lib/motion";
import { formatINR } from "@/lib/money";
import { formatDate, formatInstantTime, toIst } from "@/lib/time";
import { site, whatsappLink } from "@/lib/site";
import { useMotionSafe } from "@/lib/use-motion-safe";
import { cn } from "@/lib/utils";
import type { HoldDto } from "./api";

export type Outcome = "confirmed" | "processing" | "needs_review";

const copy: Record<Outcome, { title: string; body: string }> = {
  confirmed: { title: "You're booked!", body: "We can't wait to see you. Your booking details are below." },
  processing: {
    title: "Payment received",
    body: "We're confirming your booking with the bank. This usually takes under a minute; you don't need to pay again.",
  },
  needs_review: {
    title: "We've got your payment",
    body: "But we couldn't confirm the slot automatically. The studio will contact you shortly, and you'll be refunded if needed.",
  },
};

export function Confirmation({ outcome, hold, onBookAnother }: { outcome: Outcome; hold: HoldDto; onBookAnother: () => void }) {
  const m = useMotionSafe({ initial: { scale: 0.6, opacity: 0 }, animate: { scale: 1, opacity: 1 } }, ICON_SPRING);
  const start = new Date(hold.startsAt);
  const when = `${formatDate(toIst(start).date)}, ${formatInstantTime(start)}`;
  const services = hold.items.map((i) => i.name).join(", ");
  const Icon = outcome === "confirmed" ? Check : outcome === "processing" ? Hourglass : TriangleAlert;
  const whatsapp = whatsappLink(`Hi! My booking ${hold.code} is on ${when} (${services}).`);

  function addToCalendar() {
    downloadIcs(
      `${hold.code}.ics`,
      buildIcs({
        uid: `${hold.bookingId}@daybook`,
        title: `${site.name}: ${services}`,
        start,
        end: new Date(hold.endsAt),
        description: `Booking ${hold.code} with ${hold.staff.name}.`,
        location: site.address || undefined,
      }),
    );
  }

  return (
    <section aria-labelledby="confirmation-title" className="mx-auto max-w-xl py-4 text-center">
      <motion.span
        className={cn(
          "mx-auto flex size-16 items-center justify-center rounded-full",
          outcome === "needs_review" ? "bg-warning/10 text-warning" : "bg-accent-soft text-accent-hover",
        )}
        {...m}
      >
        <Icon aria-hidden className="size-8" strokeWidth={2.5} />
      </motion.span>
      <h2 id="confirmation-title" tabIndex={-1} className="mt-5 text-[28px] font-semibold tracking-[-0.025em] outline-none">
        {copy[outcome].title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[16px] text-muted">{copy[outcome].body}</p>

      <div className="card mt-8 p-5 text-left">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[14px] text-muted">Booking reference</span>
          <Code className="text-[15px]">{hold.code}</Code>
        </div>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[15px]">
          <Row label="When" value={when} />
          <Row label="Artist" value={hold.staff.name} />
          <Row label="Services" value={services} />
          {hold.amountDueNowPaise > 0 && <Row label="Paid online" value={formatINR(hold.amountDueNowPaise)} />}
          <Row label="Pay at the studio" value={formatINR(hold.totalPaise - hold.amountDueNowPaise)} />
        </dl>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        {outcome !== "needs_review" && (
          <Button size="pub-md" onClick={addToCalendar}>
            <CalendarPlus /> Add to calendar
          </Button>
        )}
        {whatsapp && (
          <Button asChild size="pub-md">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> WhatsApp us
            </a>
          </Button>
        )}
        <Button variant="ghost" size="pub-md" onClick={onBookAnother}>
          Book another appointment
        </Button>
      </div>
    </section>
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
