"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { SURFACE_SPRING, toastIn } from "@/lib/motion";
import { useMotionSafe } from "@/lib/use-motion-safe";
import { cn } from "@/lib/utils";

/** Toasts. DESIGN.md §5 Overlays + §6 (`toastIn`, layout reflow). */

type Tone = "info" | "success" | "error";
type ToastItem = { id: number; title: ReactNode; description?: ReactNode; tone: Tone; duration: number };
type ToastInput = { title: ReactNode; description?: ReactNode; tone?: Tone; duration?: number };

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside <ToastProvider>");
  return toast;
}

const icons = { info: Info, success: CircleCheck, error: CircleAlert } as const;
const iconTone = { info: "text-muted", success: "text-success", error: "text-danger" } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const m = useMotionSafe(toastIn, SURFACE_SPRING);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    ({ title, description, tone = "info", duration = 4000 }: ToastInput) => {
      const id = nextId.current++;
      setItems((all) => [...all.slice(-3), { id, title, description, tone, duration }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:items-end"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const Icon = icons[t.tone];
            return (
              <motion.div
                key={t.id}
                layout
                role={t.tone === "error" ? "alert" : "status"}
                className="glass pointer-events-auto flex w-[min(380px,100vw-2rem)] items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] text-ink"
                {...m}
              >
                <Icon aria-hidden className={cn("mt-px size-4 shrink-0", iconTone[t.tone])} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-muted">{t.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="-m-1 rounded-md p-1 text-muted transition-colors hover:bg-hover hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
