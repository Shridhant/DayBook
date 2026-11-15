"use client";

import { useReducedMotion, type Transition } from "motion/react";

type Preset = {
  initial?: object | false;
  animate?: object;
  exit?: object;
  transition?: Transition;
};

/**
 * Applies DESIGN.md §6 "Reduced motion": springs become instant, `initial` is skipped,
 * exits become a plain short opacity fade.
 */
export function useMotionSafe<P extends Preset>(preset: P, transition?: Transition) {
  const reduce = useReducedMotion();
  if (!reduce) return { ...preset, transition: transition ?? preset.transition };
  return {
    initial: false as const,
    animate: { opacity: 1 },
    exit: { opacity: 0, transition: { duration: 0.1 } },
    transition: { duration: 0 },
  };
}
