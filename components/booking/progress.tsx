"use client";

import { motion, useReducedMotion } from "motion/react";
import { PILL_SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const STEP_LABELS = ["Services", "Artist", "Time", "Details", "Pay"] as const;

/** DESIGN.md §11.5 Progress: labels on md+, "Step n of 5" with a bar on phones. */
export function BookingProgress({ step, onJump }: { step: number; onJump: (step: number) => void }) {
  const reduce = useReducedMotion();
  const total = STEP_LABELS.length;

  return (
    <nav aria-label="Booking progress">
      <div className="md:hidden">
        <p className="text-[14px] font-medium text-muted">
          Step {step + 1} of {total} · <span className="text-ink">{STEP_LABELS[step]}</span>
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-hover">
          <motion.div
            className="h-full rounded-full bg-brand"
            initial={false}
            animate={{ width: `${((step + 1) / total) * 100}%` }}
            transition={reduce ? { duration: 0 } : PILL_SPRING}
          />
        </div>
      </div>

      <ol className="hidden items-center gap-2 md:flex">
        {STEP_LABELS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="flex items-center gap-2">
              <button
                type="button"
                disabled={!done}
                onClick={() => onJump(i)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-[14px] font-medium transition-colors",
                  "outline-none focus-visible:ring-3 focus-visible:ring-brand/30",
                  current ? "text-ink" : done ? "text-ink/70 hover:text-ink" : "text-muted",
                  done && "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[12px] tabular-nums",
                    current ? "bg-ink text-surface" : done ? "bg-accent-soft text-accent-hover" : "bg-hover text-muted",
                  )}
                >
                  {i + 1}
                </span>
                {label}
              </button>
              {i < total - 1 && <span aria-hidden className="h-px w-6 bg-line" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
