import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Public-site layout primitives (DESIGN.md §11.1–11.2).
 * Server components: no client JS.
 */

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("container-page", className)} {...props} />;
}

/** A full-width band with standard vertical rhythm. Alternate `tone` between sections. */
export function PageSection({
  tone = "surface",
  className,
  children,
  ...props
}: ComponentProps<"section"> & { tone?: "surface" | "canvas" | "ink" }) {
  return (
    <section
      className={cn(
        "section-y",
        tone === "surface" && "bg-surface",
        tone === "canvas" && "bg-canvas",
        tone === "ink" && "bg-ink text-surface",
        className,
      )}
      {...props}
    >
      <Container>{children}</Container>
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

export function DisplayTitle({ className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      className={cn("text-[clamp(2.5rem,8.5vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-balance", className)}
      {...props}
    />
  );
}

export function SectionTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-[clamp(1.75rem,4.5vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-balance", className)}
      {...props}
    />
  );
}

export function Lead({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("max-w-[56ch] text-[17px] leading-relaxed text-muted md:text-[19px]", className)} {...props} />;
}

/** Eyebrow → title → lead, as specified in §11.2. */
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
        "mb-10 flex flex-col gap-6 md:mb-14",
        center ? "lg:items-center lg:text-center" : "md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className={cn(center && "lg:flex lg:flex-col lg:items-center")}>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <SectionTitle className={cn(eyebrow && "mt-3")}>{title}</SectionTitle>
        {lead && <Lead className="mt-4">{lead}</Lead>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}

/** Pink highlight for one word in a display or section title (≥ 24px only, see §10). */
export function Accent({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("text-brand", className)} {...props} />;
}
