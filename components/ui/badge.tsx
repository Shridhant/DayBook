import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** DESIGN.md §5 Chip: small read-only label with a tone. */
export const chipVariants = cva(
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset",
  {
    variants: {
      tone: {
        neutral: "bg-hover text-muted ring-line",
        accent: "bg-accent-soft text-accent-hover ring-brand/20",
        success: "bg-success/10 text-success ring-success/20",
        warning: "bg-warning/10 text-warning ring-warning/20",
        danger: "bg-danger/10 text-danger ring-danger/20",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Chip({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />;
}

/** DESIGN.md §5 Page status pill with a coloured dot. */
const dotTone = {
  neutral: "bg-muted",
  accent: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

export function StatusPill({
  tone = "neutral",
  className,
  children,
  ...props
}: ComponentProps<"span"> & { tone?: keyof typeof dotTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border border-line px-2 text-xs font-medium text-muted",
        className,
      )}
      {...props}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", dotTone[tone])} />
      {children}
    </span>
  );
}

/** Small counter used in nav items and tabs. */
export function Count({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("rounded-md bg-hover px-1.5 text-[11px] font-medium tabular-nums text-muted", className)}
      {...props}
    />
  );
}

/** Monospace code for IDs and booking references (`.ent-code`). */
export function Code({ className, ...props }: ComponentProps<"code">) {
  return <code className={cn("ent-code", className)} {...props} />;
}
