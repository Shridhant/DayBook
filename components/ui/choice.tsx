import { cva, type VariantProps } from "class-variance-authority";
import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Selectable controls for the public site and booking flow (DESIGN.md §11.4, §11.5).
 * All are real `<button>`s with `aria-pressed`, so they work with keyboard and screen readers.
 */

/* ---------- FilterChip: portfolio/category filters ---------- */

export function FilterChip({
  selected,
  className,
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[14px] font-medium whitespace-nowrap transition-colors duration-150",
        "outline-none focus-visible:ring-3 focus-visible:ring-brand/30",
        selected ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink hover:bg-hover",
        className,
      )}
      {...props}
    />
  );
}

/* ---------- SlotChip: booking time slots ---------- */

export function SlotChip({
  selected,
  className,
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-full border px-3 text-[15px] font-medium tabular-nums transition-colors duration-150",
        "outline-none focus-visible:ring-3 focus-visible:ring-brand/30",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through",
        selected ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink hover:bg-hover",
        className,
      )}
      {...props}
    />
  );
}

/* ---------- DateTile: booking date strip ---------- */

export function DateTile({
  weekday,
  day,
  month,
  selected,
  className,
  disabled,
  ...props
}: Omit<ComponentProps<"button">, "children"> & {
  weekday: string;
  day: number | string;
  month?: string;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        "flex h-[72px] w-16 shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors duration-150",
        "outline-none focus-visible:ring-3 focus-visible:ring-brand/30",
        "disabled:cursor-not-allowed disabled:opacity-40",
        selected ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink hover:bg-hover",
        className,
      )}
      {...props}
    >
      <span className={cn("text-[12px] font-medium uppercase tracking-wide", selected ? "text-surface/70" : "text-muted")}>
        {weekday}
      </span>
      <span className={cn("text-[20px] font-semibold tabular-nums leading-none", disabled && "line-through")}>{day}</span>
      {month && <span className={cn("text-[11px]", selected ? "text-surface/70" : "text-muted")}>{month}</span>}
    </button>
  );
}

/* ---------- OptionCard: selectable service row / technician card ---------- */

const optionCardVariants = cva(
  [
    "group relative flex w-full items-center gap-3 rounded-xl border text-left transition-colors duration-150",
    "outline-none focus-visible:ring-3 focus-visible:ring-brand/30",
    "disabled:cursor-not-allowed disabled:opacity-45",
  ],
  {
    variants: {
      layout: {
        row: "min-h-16 p-4",
        stack: "flex-col items-center p-4 text-center",
      },
      selected: {
        true: "border-brand bg-accent-soft",
        false: "border-line bg-surface hover:bg-hover",
      },
    },
    defaultVariants: { layout: "row", selected: false },
  },
);

export function OptionCard({
  selected = false,
  layout,
  indicator = "check",
  className,
  children,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof optionCardVariants> & {
    /** `check` shows a round checkbox at the end (multi-select); `none` hides it. */
    indicator?: "check" | "none";
    children: ReactNode;
  }) {
  return (
    <button
      type="button"
      aria-pressed={selected ?? false}
      className={cn(optionCardVariants({ layout, selected }), className)}
      {...props}
    >
      {children}
      {indicator === "check" && (
        <span
          aria-hidden
          className={cn(
            "ml-auto flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
            layout === "stack" && "absolute top-3 right-3",
            selected ? "border-accent bg-accent text-white" : "border-line bg-surface text-transparent",
          )}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
