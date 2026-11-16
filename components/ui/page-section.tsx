import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Public-site layout primitives (DESIGN.md §11.1–11.2).
 * Server components: no client JS.
 */

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("container-page", className)} {...props} />;
}

/**
 * A landing-page section: a large white rounded panel on the grey page, like cards on a table.
 * `ink` is the one dark panel (final CTA).
 */
export function PageSection({
  tone = "surface",
  className,
  children,
  ...props
}: ComponentProps<"section"> & { tone?: "surface" | "ink" }) {
  return (
    <section className={cn("py-1.5 md:py-2.5", className)} {...props}>
      <div className="mx-auto w-full max-w-[1280px] px-2 sm:px-4 lg:px-6">
        <div
          className={cn(
            "rounded-[24px] px-4 py-10 sm:px-6 md:rounded-[32px] md:px-10 md:py-14 lg:px-12 lg:py-16",
            tone === "ink" ? "bg-ink text-surface" : "bg-surface",
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-[12px] font-medium uppercase tracking-[0.12em] text-accent-hover", className)}
      {...props}
    />
  );
}

/** "/Services": the section label of the landing page, with the slash in the brand colour. */
export function SectionLabel({ className, children, ...props }: ComponentProps<"p">) {
  return (
    <p className={cn("text-[14px] font-medium text-ink", className)} {...props}>
      <span className="text-brand" aria-hidden>
        /
      </span>
      {children}
    </p>
  );
}

/** The quieter second half of a two-tone heading ("Explore <Muted>our creations</Muted>"). */
export function Muted({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("text-muted", className)} {...props} />;
}

export function DisplayTitle({ className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      className={cn("text-[clamp(2.5rem,7.5vw,4.25rem)] font-medium leading-[1.04] tracking-[-0.04em] text-balance", className)}
      {...props}
    />
  );
}

export function SectionTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-[clamp(1.75rem,4.2vw,2.75rem)] font-medium leading-[1.12] tracking-[-0.03em] text-balance", className)}
      {...props}
    />
  );
}

export function Lead({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("max-w-[56ch] text-[17px] leading-relaxed text-muted md:text-[19px]", className)} {...props} />;
}

/**
 * Label → two-tone title on the left; lead and actions on the right from `md` (stacked on phones).
 * `center` stacks everything in the middle (reviews).
 */
export function SectionHeader({
  eyebrow,
  title,
  lead,
  align = "start",
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  align?: "start" | "center";
  actions?: ReactNode;
  className?: string;
}) {
  const center = align === "center";
  return (
    <header
      className={cn(
        "mb-8 flex flex-col gap-5 md:mb-12",
        center ? "items-center text-center" : "md:flex-row md:items-end md:justify-between md:gap-10",
        className,
      )}
    >
      <div className={cn("min-w-0", center && "flex flex-col items-center")}>
        {eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}
        <SectionTitle className={cn("max-w-[22ch]", eyebrow && "mt-3")}>{title}</SectionTitle>
      </div>
      {(lead || actions) && (
        <div className={cn("flex shrink-0 flex-col gap-4", center ? "items-center" : "md:max-w-[36ch] md:items-end md:text-right")}>
          {lead && <p className="text-[15px] leading-relaxed text-muted md:text-[16px]">{lead}</p>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
    </header>
  );
}

/** Pink highlight for one word in a display or section title (≥ 24px only, see §10). */
export function Accent({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("text-brand", className)} {...props} />;
}
