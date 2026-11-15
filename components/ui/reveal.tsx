"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { revealIn, revealStagger } from "@/lib/motion";

/**
 * Scroll reveal for public sections (DESIGN.md §11.6). Reveals once.
 * `index` staggers siblings by 60ms, capped at 6.
 */
export function Reveal({
  children,
  index = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  index?: number;
  className?: string;
  as?: "div" | "li" | "section" | "article";
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  if (reduce) return <Comp className={className}>{children}</Comp>;
  return (
    <Comp
      className={className}
      initial={revealIn.initial}
      whileInView={revealIn.whileInView}
      viewport={revealIn.viewport}
      transition={{ ...revealIn.transition, delay: revealStagger(index) }}
    >
      {children}
    </Comp>
  );
}
