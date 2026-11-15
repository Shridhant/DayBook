/**
 * Motion constants. DESIGN.md §6, §8 (app) and §11.6 (public).
 * Every animated component must also respect `useReducedMotion()`; see `useMotionSafe` in
 * `lib/use-motion-safe.ts`.
 */
import type { Transition } from "motion/react";

export const PILL_SPRING = { type: "spring", stiffness: 520, damping: 40, mass: 0.7 } as const;
export const LAYER_SPRING = { type: "spring", stiffness: 520, damping: 34, mass: 0.6 } as const;
export const ICON_SPRING = { type: "spring", stiffness: 520, damping: 32 } as const;
export const TOOLTIP_SPRING = { type: "spring", stiffness: 520, damping: 34 } as const;
export const SURFACE_SPRING = { type: "spring", stiffness: 460, damping: 34 } as const;
export const CONFIRM_SPRING = { type: "spring", stiffness: 480, damping: 34 } as const;
export const WIDTH_SPRING = { type: "spring", stiffness: 420, damping: 40, mass: 0.8 } as const;
export const DRAWER_SPRING = { type: "spring", stiffness: 420, damping: 40 } as const;
export const NAV_INTRO_SPRING = { type: "spring", stiffness: 380, damping: 30 } as const;

export const LABEL_FADE = { duration: 0.16, ease: "easeOut" } as const;
export const COLLAPSE = { duration: 0.22, ease: [0.4, 0, 0.2, 1] } as const;
export const SCRIM_FADE = { duration: 0.15 } as const;

/** Menus, popovers. */
export const layerIn = {
  initial: { opacity: 0, scale: 0.96, filter: "blur(6px)", y: -2 },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)", y: 0 },
  exit: { opacity: 0, scale: 0.98, filter: "blur(4px)", transition: { duration: 0.1 } },
};

/** Modals. */
export const modalIn = {
  initial: { opacity: 0, y: 8, scale: 0.98, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, y: 6, scale: 0.98, filter: "blur(4px)", transition: { duration: 0.12 } },
};

/** Confirm dialog. */
export const confirmIn = {
  initial: { opacity: 0, scale: 0.96, filter: "blur(6px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.12 } },
};

/** Toasts. */
export const toastIn = {
  initial: { opacity: 0, y: 12, scale: 0.97, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, x: 24, transition: { duration: 0.14 } },
};

/** Tooltip. */
export const tooltipIn = {
  initial: { opacity: 0, x: -4, filter: "blur(4px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: { opacity: 0, transition: { duration: 0.08 } },
};

/** Page content on mount / tab change. */
export const pageIn = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: "easeOut" } satisfies Transition,
};

/** List stagger, capped at 20 items (app). */
export const staggerDelay = (i: number) => Math.min(i, 20) * 0.015;

/* ---------- Public site (DESIGN.md §11.6) ---------- */

/** Scroll reveal for section headers and cards. */
export const revealIn = {
  initial: { opacity: 0, y: 12, filter: "blur(4px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5, ease: "easeOut" } satisfies Transition,
};

/** Public reveal stagger: 60ms per item, capped at 6. */
export const revealStagger = (i: number) => Math.min(i, 6) * 0.06;
