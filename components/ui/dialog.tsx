"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Dialog as RDialog } from "radix-ui";
import { createContext, useContext, useState, type ReactNode } from "react";
import { CONFIRM_SPRING, confirmIn, DRAWER_SPRING, modalIn, SCRIM_FADE, SURFACE_SPRING } from "@/lib/motion";
import { useControllable } from "@/lib/use-controllable";
import { useMotionSafe } from "@/lib/use-motion-safe";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Dialog, Sheet (drawer) and ConfirmDialog. DESIGN.md §5 Overlays + §6 enter/exit recipes.
 * Radix handles focus trap, Escape, scroll lock and aria; motion handles enter/exit.
 */

const OpenContext = createContext(false);

type RootProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

export function Dialog({ open, defaultOpen = false, onOpenChange, children }: RootProps) {
  const [isOpen, setOpen] = useControllable(open, defaultOpen, onOpenChange);
  return (
    <OpenContext.Provider value={isOpen}>
      <RDialog.Root open={isOpen} onOpenChange={setOpen}>
        {children}
      </RDialog.Root>
    </OpenContext.Provider>
  );
}

export const DialogTrigger = RDialog.Trigger;
export const DialogClose = RDialog.Close;

const scrimPreset = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

function Scrim({ className }: { className?: string }) {
  const m = useMotionSafe(scrimPreset, SCRIM_FADE);
  return (
    <RDialog.Overlay asChild forceMount>
      <motion.div className={cn("fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px]", className)} {...m} />
    </RDialog.Overlay>
  );
}

const dialogSizes = {
  sm: "max-w-[400px]",
  md: "max-w-xl",
  lg: "max-w-3xl",
} as const;

export function DialogContent({
  title,
  description,
  children,
  footer,
  size = "md",
  surface = "app",
  hideTitle = false,
  className,
}: {
  /** Always required for screen readers; use `hideTitle` to hide it visually. */
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof dialogSizes;
  surface?: "app" | "public";
  hideTitle?: boolean;
  className?: string;
}) {
  const open = useContext(OpenContext);
  const m = useMotionSafe(modalIn, SURFACE_SPRING);
  const pub = surface === "public";

  return (
    <AnimatePresence>
      {open && (
        <RDialog.Portal forceMount>
          <Scrim />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4 sm:items-start sm:pt-[8vh]">
            <RDialog.Content asChild forceMount>
              <motion.div
                className={cn(
                  "pointer-events-auto flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-2xl border border-line bg-surface shadow-[var(--shadow-layer)] outline-none sm:max-h-[84vh]",
                  dialogSizes[size],
                  className,
                )}
                {...m}
              >
                <header className={cn("relative px-5 pt-4 pb-1 pr-12", hideTitle && "sr-only")}>
                  <RDialog.Title className={cn("font-semibold", pub ? "text-[18px] tracking-[-0.01em]" : "text-[15px]")}>
                    {title}
                  </RDialog.Title>
                  {description ? (
                    <RDialog.Description className={cn("mt-0.5 text-muted", pub ? "text-[15px]" : "text-[13px]")}>
                      {description}
                    </RDialog.Description>
                  ) : (
                    <RDialog.Description className="sr-only">{title}</RDialog.Description>
                  )}
                </header>
                <RDialog.Close asChild>
                  <Button variant="ghost" size={pub ? "pub-icon" : "icon"} className="absolute top-2.5 right-2.5" aria-label="Close">
                    <X />
                  </Button>
                </RDialog.Close>
                <div className={cn("thin-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4", pub && "text-[16px]")}>
                  {children}
                </div>
                {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
              </motion.div>
            </RDialog.Content>
          </div>
        </RDialog.Portal>
      )}
    </AnimatePresence>
  );
}

/* ---------- Sheet: side drawer (mobile nav, admin side panels) ---------- */

const sheetMotion = {
  left: { initial: { x: "-100%" }, animate: { x: 0 }, exit: { x: "-100%" } },
  right: { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } },
  bottom: { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } },
};

export const Sheet = Dialog;
export const SheetTrigger = RDialog.Trigger;
export const SheetClose = RDialog.Close;

export function SheetContent({
  side = "right",
  title,
  hideTitle = false,
  children,
  className,
}: {
  side?: keyof typeof sheetMotion;
  title: ReactNode;
  hideTitle?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const open = useContext(OpenContext);
  const m = useMotionSafe(sheetMotion[side], DRAWER_SPRING);

  return (
    <AnimatePresence>
      {open && (
        <RDialog.Portal forceMount>
          <Scrim className="bg-black/30" />
          <RDialog.Content asChild forceMount>
            <motion.div
              className={cn(
                "fixed z-50 flex flex-col bg-surface shadow-[var(--shadow-layer)] outline-none",
                side === "left" && "inset-y-0 left-0 w-[min(320px,86vw)] border-r border-line",
                side === "right" && "inset-y-0 right-0 w-[min(320px,86vw)] border-l border-line",
                side === "bottom" &&
                  "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t border-line pb-[max(12px,env(safe-area-inset-bottom))]",
                className,
              )}
              {...m}
            >
              <div className={cn("flex h-14 items-center justify-between px-4", hideTitle && "justify-end")}>
                <RDialog.Title className={cn("text-[15px] font-semibold", hideTitle && "sr-only")}>{title}</RDialog.Title>
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
                <RDialog.Close asChild>
                  <Button variant="ghost" size="pub-icon" aria-label="Close">
                    <X />
                  </Button>
                </RDialog.Close>
              </div>
              <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
            </motion.div>
          </RDialog.Content>
        </RDialog.Portal>
      )}
    </AnimatePresence>
  );
}

/* ---------- ConfirmDialog ---------- */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  /** May be async; the confirm button shows a spinner until it settles. */
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const m = useMotionSafe(confirmIn, CONFIRM_SPRING);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <Scrim />
            <div className="pointer-events-none fixed inset-0 z-50 flex justify-center px-4 pt-[22vh]">
            <RDialog.Content asChild forceMount>
              <motion.div
                role="alertdialog"
                className="pointer-events-auto h-fit w-[min(400px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-layer)] outline-none"
                {...m}
              >
                <RDialog.Title className="text-[15px] font-semibold">{title}</RDialog.Title>
                <RDialog.Description className={cn("mt-1.5 text-[13px] text-muted", !description && "sr-only")}>
                  {description ?? title}
                </RDialog.Description>
                <div className="mt-5 flex justify-end gap-2">
                  <RDialog.Close asChild>
                    <Button size="md" variant="secondary" disabled={busy}>
                      {cancelLabel}
                    </Button>
                  </RDialog.Close>
                  <Button
                    size="md"
                    variant="primary"
                    className={cn(tone === "danger" && "bg-danger hover:bg-danger/90")}
                    loading={busy}
                    onClick={handleConfirm}
                  >
                    {confirmLabel}
                  </Button>
                </div>
              </motion.div>
            </RDialog.Content>
            </div>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
