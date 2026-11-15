import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** DESIGN.md §5 Cards, sections, stats. */

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("card", className)} {...props} />;
}

/** Admin section card: icon tile + title + description + content. */
export function Section({
  icon: Icon,
  title,
  description,
  actions,
  className,
  children,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={cn("card mb-4 p-5", className)}>
      <header className="flex items-start gap-3">
        {Icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-hover text-muted">
            <Icon className="size-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </header>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

export function Stat({
  icon: Icon,
  label,
  value,
  total,
  hint,
  className,
}: {
  icon?: LucideIcon;
  label: ReactNode;
  value: ReactNode;
  total?: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-line p-4", className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
        {total != null && <span className="text-base font-normal text-muted">/{total}</span>}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-14 text-center text-muted",
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-hover">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      {title && <p className="text-[13px] font-medium text-ink">{title}</p>}
      {children && <div className="mt-1 max-w-sm text-[13px]">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
