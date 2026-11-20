"use client";

import { Check, ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DropdownMenu as RMenu, Popover as RPopover, Slot } from "radix-ui";
import { createContext, useCallback, useContext, useId, useState, type ComponentProps, type FocusEvent, type ReactNode } from "react";
import { inputVariants, useFieldProps } from "@/components/ui/input";
import { LAYER_SPRING, PILL_SPRING, layerIn } from "@/lib/motion";
import { useControllable } from "@/lib/use-controllable";
import { useMotionSafe } from "@/lib/use-motion-safe";
import { cn } from "@/lib/utils";

/**
 * DropdownMenu, Select and Popover. DESIGN.md §5 Overlays: glass surface, `layerIn` on LAYER_SPRING,
 * scaling out of the trigger's corner (Radix's transform origin). The highlighted row is one shared
 * surface that springs from row to row (DESIGN.md §6 "Gliding highlight"), for pointer and keyboard.
 */

type RootProps = { open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; children: ReactNode };

/* ---------- Gliding focus surface ---------- */

type SurfaceCtx = { active: string | null; setActive: (id: string | null) => void; layoutId: string };
const SurfaceContext = createContext<SurfaceCtx | null>(null);

/**
 * Tracks which row is highlighted. Radix moves real focus to the row under the pointer or arrow
 * keys and back to the menu itself when the pointer leaves, so focus events are the one signal.
 */
function useSurfaceScope() {
  const [active, setActive] = useState<string | null>(null);
  const layoutId = useId();
  const onFocus = useCallback((e: FocusEvent<HTMLElement>) => {
    if (e.target === e.currentTarget) setActive(null);
  }, []);
  return { ctx: { active, setActive, layoutId }, onFocus };
}

/** Wire a row into the surface: returns its focus handler and the surface element to render inside it. */
export function useFocusSurface(tone: "default" | "danger" = "default") {
  const ctx = useContext(SurfaceContext);
  const id = useId();
  const reduce = useReducedMotion();
  const on = ctx?.active === id;
  return {
    onFocus: () => ctx?.setActive(id),
    surface: on ? (
      <motion.span
        aria-hidden
        layoutId={ctx.layoutId}
        transition={reduce ? { duration: 0 } : PILL_SPRING}
        className={cn("absolute inset-0 -z-10 rounded-lg", tone === "danger" ? "bg-danger/10" : "bg-hover")}
      />
    ) : null,
  };
}

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
  return (
    <AnimatePresence>
      {open && (
        <RMenu.Portal forceMount>
          <MenuSurface side={side} align={align} sideOffset={sideOffset} className={className}>
            {children}
          </MenuSurface>
        </RMenu.Portal>
      )}
    </AnimatePresence>
  );
}

/** The menu panel: glass, corner-origin scale-in, and the scope of the gliding row surface. */
function MenuSurface({
  children,
  side,
  align,
  sideOffset,
  className,
  matchTrigger = false,
}: {
  children: ReactNode;
  side: "top" | "right" | "bottom" | "left";
  align: "start" | "center" | "end";
  sideOffset: number;
  className?: string;
  /** At least as wide as the trigger (selects). */
  matchTrigger?: boolean;
}) {
  const m = useMotionSafe(layerIn, LAYER_SPRING);
  const { ctx, onFocus } = useSurfaceScope();
  return (
    <RMenu.Content asChild forceMount side={side} align={align} sideOffset={sideOffset} collisionPadding={8} loop onFocus={onFocus}>
      <motion.div
        className={cn(
          "glass thin-scroll z-50 min-w-44 overflow-y-auto rounded-xl p-1 text-[13px] text-ink outline-none",
          "max-h-[min(70vh,var(--radix-dropdown-menu-content-available-height))] origin-[var(--radix-dropdown-menu-content-transform-origin)]",
          matchTrigger && "min-w-[var(--radix-dropdown-menu-trigger-width)]",
          className,
        )}
        {...m}
      >
        <SurfaceContext.Provider value={ctx}>{children}</SurfaceContext.Provider>
      </motion.div>
    </RMenu.Content>
  );
}

const itemClass =
  "relative isolate flex h-8 cursor-default select-none items-center gap-2 rounded-lg px-2.5 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-45 [&_svg]:size-4 [&_svg]:text-muted";

export function MenuItem({
  className,
  tone = "default",
  children,
  onFocus,
  ...props
}: ComponentProps<typeof RMenu.Item> & { tone?: "default" | "danger" }) {
  const f = useFocusSurface(tone);
  return (
    <RMenu.Item
      className={cn(itemClass, tone === "danger" && "text-danger [&_svg]:text-danger", className)}
      onFocus={(e) => {
        f.onFocus();
        onFocus?.(e);
      }}
      {...props}
    >
      {f.surface}
      {/* With asChild (a Link row), the link becomes the row and the surface renders inside it. */}
      <Slot.Slottable>{children}</Slot.Slottable>
    </RMenu.Item>
  );
}

export function MenuCheckboxItem({ className, children, onFocus, ...props }: ComponentProps<typeof RMenu.CheckboxItem>) {
  const f = useFocusSurface();
  return (
    <RMenu.CheckboxItem
      className={cn(itemClass, "pr-8", className)}
      onFocus={(e) => {
        f.onFocus();
        onFocus?.(e);
      }}
      {...props}
    >
      {f.surface}
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

/* ---------- Select ---------- */

export type SelectOption<V extends string = string> = {
  value: V;
  label: ReactNode;
  /** Muted second line. */
  hint?: ReactNode;
  disabled?: boolean;
  /** For typeahead when `label` isn't plain text. */
  textValue?: string;
};

/**
 * Pick one value from a list: an input-styled trigger opening an animated menu (radio items,
 * typeahead, arrow keys, Home/End, Escape). Controlled (`value` + `onValueChange`) or uncontrolled
 * (`defaultValue`). With `name`, a hidden input carries the value in plain HTML forms. Inside a
 * `<Field>`, the field's label points at the trigger.
 */
export function Select<V extends string = string>({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select…",
  name,
  disabled,
  size = "app",
  align = "start",
  className,
  contentClassName,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: {
  options: SelectOption<V>[];
  value?: V;
  defaultValue?: V;
  onValueChange?: (value: V) => void;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  size?: "app" | "app-lg" | "public";
  align?: "start" | "end";
  className?: string;
  contentClassName?: string;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [current, setCurrent] = useControllable<V | undefined>(value, defaultValue, (v) => v !== undefined && onValueChange?.(v));
  const [open, setOpen] = useState(false);
  const field = useFieldProps({ id, "aria-describedby": ariaDescribedBy, "aria-invalid": ariaInvalid });
  const reduce = useReducedMotion();
  const selected = options.find((o) => o.value === current);
  const resolvedSize = size === "app" && field.size === "public" ? "public" : size;

  return (
    <MenuOpen.Provider value={open}>
      <RMenu.Root open={open} onOpenChange={setOpen}>
        <RMenu.Trigger
          disabled={disabled}
          aria-label={ariaLabel}
          {...field.props}
          className={cn(
            inputVariants({ size: resolvedSize }),
            "flex items-center justify-between gap-2 text-left data-[state=open]:border-accent data-[state=open]:ring-3 data-[state=open]:ring-accent/15",
            className,
          )}
        >
          <span className={cn("min-w-0 truncate", !selected && "text-muted/70")}>{selected?.label ?? placeholder}</span>
          <motion.span aria-hidden animate={{ rotate: open ? 180 : 0 }} transition={reduce ? { duration: 0 } : PILL_SPRING} className="flex shrink-0 text-muted">
            <ChevronDown className={resolvedSize === "public" ? "size-[18px]" : "size-4"} />
          </motion.span>
        </RMenu.Trigger>
        {name && <input type="hidden" name={name} value={current ?? ""} />}
        <AnimatePresence>
          {open && (
            <RMenu.Portal forceMount>
              <MenuSurface side="bottom" align={align} sideOffset={6} matchTrigger className={contentClassName}>
                <RMenu.RadioGroup value={current ?? ""} onValueChange={(v) => setCurrent(v as V)}>
                  {options.map((o) => (
                    <SelectItem key={o.value} option={o} large={resolvedSize === "public"} />
                  ))}
                </RMenu.RadioGroup>
              </MenuSurface>
            </RMenu.Portal>
          )}
        </AnimatePresence>
      </RMenu.Root>
    </MenuOpen.Provider>
  );
}

function SelectItem({ option, large }: { option: SelectOption; large: boolean }) {
  const f = useFocusSurface();
  return (
    <RMenu.RadioItem
      value={option.value}
      disabled={option.disabled}
      textValue={option.textValue ?? (typeof option.label === "string" ? option.label : undefined)}
      onFocus={f.onFocus}
      className={cn(itemClass, "h-auto min-h-8 py-1.5 pr-8 data-[state=checked]:font-medium", large && "min-h-11 text-[15px]")}
    >
      {f.surface}
      <span className="min-w-0">
        <span className="block">{option.label}</span>
        {option.hint && <span className="block text-xs font-normal text-muted">{option.hint}</span>}
      </span>
      <RMenu.ItemIndicator className="absolute right-2.5 flex">
        <Check className="!text-accent" />
      </RMenu.ItemIndicator>
    </RMenu.RadioItem>
  );
}
