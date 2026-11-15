"use client";

import { AnimatePresence, motion } from "motion/react";
import { Tooltip as RTooltip } from "radix-ui";
import { useState, type ReactNode } from "react";
import { TOOLTIP_SPRING, tooltipIn } from "@/lib/motion";
import { useMotionSafe } from "@/lib/use-motion-safe";
import { cn } from "@/lib/utils";

/** Wrap the app once (e.g. in the admin layout). Delay 80ms per DESIGN.md §5. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RTooltip.Provider delayDuration={80}>{children}</RTooltip.Provider>;
}

export function Tooltip({
  content,
  side = "top",
  children,
  className,
}: {
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  /** A single focusable element. */
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const m = useMotionSafe(tooltipIn, TOOLTIP_SPRING);
  return (
    <RTooltip.Root open={open} onOpenChange={setOpen}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <AnimatePresence>
        {open && (
          <RTooltip.Portal forceMount>
            <RTooltip.Content asChild forceMount side={side} sideOffset={10}>
              <motion.div className={cn("glass z-50 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink", className)} {...m}>
                {content}
              </motion.div>
            </RTooltip.Content>
          </RTooltip.Portal>
        )}
      </AnimatePresence>
    </RTooltip.Root>
  );
}
