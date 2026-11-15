"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { PILL_SPRING } from "@/lib/motion";
import { useControllable } from "@/lib/use-controllable";
import { cn } from "@/lib/utils";

/**
 * Tab bar with a gliding active pill (DESIGN.md §6 "Gliding highlight").
 * Renders only the bar; the consumer renders the panel for `value`.
 * `app` size: 13px dense tabs. `public` size: touch-sized, horizontally scrollable on phones.
 */
export type TabItem<V extends string> = { value: V; label: ReactNode; count?: number };

export function Tabs<V extends string>({
  items,
  value,
  defaultValue,
  onValueChange,
  size = "app",
  label,
  className,
}: {
  items: TabItem<V>[];
  value?: V;
  defaultValue?: V;
  onValueChange?: (value: V) => void;
  size?: "app" | "public";
  /** Accessible name for the tab list. */
  label: string;
  className?: string;
}) {
  const [current, setCurrent] = useControllable(value, defaultValue ?? items[0]?.value, onValueChange);
  const groupId = useId();
  const reduce = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const pub = size === "public";

  function onKeyDown(e: KeyboardEvent, index: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (index + delta + items.length) % items.length;
    refs.current[next]?.focus();
    setCurrent(items[next].value);
  }

  return (
    <LayoutGroup id={groupId}>
      <div
        role="tablist"
        aria-label={label}
        className={cn(
          "flex items-center",
          pub ? "no-scrollbar -mx-4 gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" : "gap-0.5",
          className,
        )}
      >
        {items.map((item, i) => {
          const active = item.value === current;
          return (
            <button
              key={item.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setCurrent(item.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "relative isolate inline-flex shrink-0 items-center gap-1.5 font-medium whitespace-nowrap outline-none transition-colors duration-150",
                pub
                  ? "h-10 rounded-full px-4 text-[15px] focus-visible:ring-3 focus-visible:ring-brand/30"
                  : "h-7 rounded-lg px-2.5 text-[13px] focus-visible:ring-3 focus-visible:ring-accent/25",
                active ? (pub ? "text-surface" : "text-ink") : pub ? "text-ink/70 hover:text-ink" : "text-muted hover:text-ink",
              )}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  aria-hidden
                  transition={reduce ? { duration: 0 } : PILL_SPRING}
                  className={cn(
                    "absolute inset-0 -z-10 rounded-[inherit]",
                    pub ? "bg-ink" : "bg-hover shadow-[inset_0_0_0_1px_var(--border)]",
                  )}
                />
              )}
              {item.label}
              {item.count != null && (
                <span className={cn("text-xs tabular-nums", active && pub ? "text-surface/70" : "text-muted")}>{item.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
