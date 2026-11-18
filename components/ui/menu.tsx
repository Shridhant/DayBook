"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { DropdownMenu as RMenu, Popover as RPopover } from "radix-ui";
import { createContext, useContext, type ComponentProps, type ReactNode } from "react";
import { LAYER_SPRING, layerIn } from "@/lib/motion";
import { useControllable } from "@/lib/use-controllable";
import { useMotionSafe } from "@/lib/use-motion-safe";
import { cn } from "@/lib/utils";

/**
 * DropdownMenu and Popover. DESIGN.md §5 Overlays: glass surface, `layerIn` on LAYER_SPRING.
 */

type RootProps = { open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; children: ReactNode };

/* ---------- DropdownMenu ---------- */

const MenuOpen = createContext(false);

export function Menu({ open, defaultOpen = false, onOpenChange, children }: RootProps) {
  const [isOpen, setOpen] = useControllable(open, defaultOpen, onOpenChange);
  return (
    <MenuOpen.Provider value={isOpen}>
      <RMenu.Root open={isOpen} onOpenChange={setOpen}>
        {children}
      </RMenu.Root>
    </MenuOpen.Provider>
  );
}

export const MenuTrigger = RMenu.Trigger;

export function MenuContent({
  children,
  side = "bottom",
  align = "end",
  sideOffset = 6,
  className,
}: {
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  className?: string;
}) {
  const open = useContext(MenuOpen);
  const m = useMotionSafe(layerIn, LAYER_SPRING);
  return (
    <AnimatePresence>
      {open && (
        <RMenu.Portal forceMount>
          <RMenu.Content asChild forceMount side={side} align={align} sideOffset={sideOffset}>
            <motion.div
              className={cn(
                "glass thin-scroll z-50 min-w-44 overflow-y-auto rounded-xl p-1 text-[13px] text-ink outline-none",
                "max-h-[min(70vh,var(--radix-dropdown-menu-content-available-height))] origin-[var(--radix-dropdown-menu-content-transform-origin)]",
                className,
              )}
              {...m}
            >
              {children}
            </motion.div>
          </RMenu.Content>
        </RMenu.Portal>
      )}
    </AnimatePresence>
  );
}

const itemClass =
  "relative flex h-8 cursor-default select-none items-center gap-2 rounded-lg px-2.5 outline-none transition-colors duration-100 data-[highlighted]:bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-45 [&_svg]:size-4 [&_svg]:text-muted";

export function MenuItem({
  className,
  tone = "default",
  ...props
}: ComponentProps<typeof RMenu.Item> & { tone?: "default" | "danger" }) {
  return (
    <RMenu.Item
      className={cn(itemClass, tone === "danger" && "text-danger [&_svg]:text-danger data-[highlighted]:bg-danger/10", className)}
      {...props}
    />
  );
}

export function MenuCheckboxItem({ className, children, ...props }: ComponentProps<typeof RMenu.CheckboxItem>) {
  return (
    <RMenu.CheckboxItem className={cn(itemClass, "pr-8", className)} {...props}>
      {children}
      <RMenu.ItemIndicator className="absolute right-2.5">
        <Check className="!text-ink" />
      </RMenu.ItemIndicator>
    </RMenu.CheckboxItem>
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof RMenu.Label>) {
  return <RMenu.Label className={cn("px-2.5 pt-2 pb-1 text-xs font-medium text-muted", className)} {...props} />;
}

export function MenuSeparator({ className, ...props }: ComponentProps<typeof RMenu.Separator>) {
  return <RMenu.Separator className={cn("-mx-1 my-1 h-px bg-line", className)} {...props} />;
}

/* ---------- Popover ---------- */

const PopoverOpen = createContext(false);

export function Popover({ open, defaultOpen = false, onOpenChange, children }: RootProps) {
  const [isOpen, setOpen] = useControllable(open, defaultOpen, onOpenChange);
  return (
    <PopoverOpen.Provider value={isOpen}>
      <RPopover.Root open={isOpen} onOpenChange={setOpen}>
        {children}
      </RPopover.Root>
    </PopoverOpen.Provider>
  );
}

export const PopoverTrigger = RPopover.Trigger;
export const PopoverClose = RPopover.Close;

export function PopoverContent({
  children,
  side = "bottom",
  align = "center",
  sideOffset = 6,
  className,
}: {
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  className?: string;
}) {
  const open = useContext(PopoverOpen);
  const m = useMotionSafe(layerIn, LAYER_SPRING);
  return (
    <AnimatePresence>
      {open && (
        <RPopover.Portal forceMount>
          <RPopover.Content asChild forceMount side={side} align={align} sideOffset={sideOffset}>
            <motion.div
              className={cn(
                "glass z-50 w-72 rounded-xl p-3 text-[13px] text-ink outline-none origin-[var(--radix-popover-content-transform-origin)]",
                className,
              )}
              {...m}
            >
              {children}
            </motion.div>
          </RPopover.Content>
        </RPopover.Portal>
      )}
    </AnimatePresence>
  );
}
