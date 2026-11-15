"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SURFACE_SPRING } from "@/lib/motion";
import { formatINR } from "@/lib/money";
import { formatDate, formatDuration, formatTime } from "@/lib/time";
import { useMotionSafe } from "@/lib/use-motion-safe";
import type { CatalogService } from "@/server/catalog";

export type SummaryProps = {
  services: CatalogService[];
  artistName: string | null;
  date: string | null;
  slotMinutes: number | null;
  continueLabel: string | null;
  canContinue: boolean;
  busy: boolean;
  onContinue: () => void;
  note?: ReactNode;
};

function totals(services: CatalogService[]) {
  return {
    price: services.reduce((sum, s) => sum + s.pricePaise, 0),
    duration: services.reduce((sum, s) => sum + s.durationMin, 0),
    from: services.some((s) => s.priceIsFrom),
  };
}

/** Desktop: sticky card beside the steps (DESIGN.md §11.5, lg+). */
export function SummaryCard(props: SummaryProps) {
  const { services, artistName, date, slotMinutes, continueLabel, canContinue, busy, onContinue, note } = props;
  const t = totals(services);

  return (
    <aside className="card sticky top-24 hidden p-6 lg:block" aria-label="Booking summary">
      <h2 className="text-[18px] font-semibold tracking-[-0.01em]">Your booking</h2>
      {services.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted">Choose one or more services to get started.</p>
      ) : (
        <ul className="mt-4 space-y-2 text-[15px]">
          {services.map((s) => (
            <li key={s.id} className="flex justify-between gap-4">
              <span>{s.name}</span>
              <span className="shrink-0 tabular-nums">
                {s.priceIsFrom && <span className="text-muted">from </span>}
                {formatINR(s.pricePaise)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-[14px]">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Duration</dt>
          <dd className="tabular-nums">{services.length ? formatDuration(t.duration) : "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Artist</dt>
          <dd>{artistName ?? "Any available"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">When</dt>
          <dd className="text-right">{date && slotMinutes !== null ? `${formatDate(date)}, ${formatTime(slotMinutes)}` : "—"}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-[15px] font-medium">Total</span>
        <span className="text-[20px] font-semibold tabular-nums">
          {t.from && <span className="text-[14px] font-normal text-muted">from </span>}
          {formatINR(t.price)}
        </span>
      </div>
      {note && <div className="mt-3 text-[14px] text-muted">{note}</div>}

      {continueLabel && (
        <Button variant="primary" size="pub-lg" block className="mt-5" disabled={!canContinue} loading={busy} onClick={onContinue}>
          {continueLabel}
        </Button>
      )}
    </aside>
  );
}

/** Phones and tablets: fixed glass bar at the bottom (DESIGN.md §11.5 "Summary bar"). */
export function SummaryBar(props: SummaryProps) {
  const { services, continueLabel, canContinue, busy, onContinue } = props;
  const t = totals(services);
  const m = useMotionSafe({ initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }, SURFACE_SPRING);
  const visible = Boolean(continueLabel);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
          {...m}
        >
          <div className="container-page flex items-center gap-3 pt-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] text-muted">
                {services.length === 0
                  ? "No services yet"
                  : `${services.length} service${services.length > 1 ? "s" : ""} · ${formatDuration(t.duration)}`}
              </p>
              <p className="text-[18px] font-semibold tabular-nums">
                {t.from && <span className="text-[14px] font-normal text-muted">from </span>}
                {formatINR(t.price)}
              </p>
            </div>
            <Button variant="primary" size="pub-md" disabled={!canContinue} loading={busy} onClick={onContinue}>
              {continueLabel}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
