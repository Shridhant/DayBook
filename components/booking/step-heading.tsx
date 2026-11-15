import type { ReactNode } from "react";

/** Step title per DESIGN.md §11.5 (22px / 24px md). Focused on step change for screen readers. */
export function StepHeading({ id, title, hint }: { id: string; title: ReactNode; hint?: ReactNode }) {
  return (
    <header>
      <h2 id={id} tabIndex={-1} className="text-[22px] font-semibold tracking-[-0.02em] outline-none md:text-[24px]">
        {title}
      </h2>
      {hint && <p className="mt-1 text-[15px] text-muted">{hint}</p>}
    </header>
  );
}
