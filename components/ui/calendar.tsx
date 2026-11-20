"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { inputVariants, useFieldProps } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { addMonths, isSelectable, monthGrid, monthLabel, monthOf, moveDay, shiftMonths, WEEKDAY_LETTERS, type DateRules } from "@/lib/calendar";
import { PILL_SPRING } from "@/lib/motion";
import { useControllable } from "@/lib/use-controllable";
import { formatDate, istToday, parseDateKey, type DateKey } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Month calendar for picking one IST date (DESIGN.md §6 motion). Months slide in the direction of
 * travel and the title rolls; the selection is one surface that glides between days. Days form an
 * ARIA grid with a roving tab stop: arrows move a day/week, Home/End the week, PageUp/PageDown a
 * month (Shift: a year), Enter/Space picks. Blocked days are skipped.
 */

/** Today in IST, known only after hydration (server HTML never contains "today"). */
export function useIstToday(): DateKey | null {
  const [today, setToday] = useState<DateKey | null>(null);
  useEffect(() => {
    const tick = () => setToday(istToday());
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}

export type CalendarProps = {
  value?: DateKey | null;
  onChange?: (date: DateKey) => void;
  /** Controlled visible month (any day in it). */
  month?: DateKey;
  onMonthChange?: (month: DateKey) => void;
  minDate?: DateKey;
  maxDate?: DateKey;
  disabledDates?: (date: DateKey) => boolean;
  /** Adds a Today button. */
  showToday?: boolean;
  /** Focus the selected (or first open) day on mount, e.g. inside a popover. */
  autoFocus?: boolean;
  className?: string;
};

export function Calendar({ value, onChange, month: monthProp, onMonthChange, minDate, maxDate, disabledDates, showToday = false, autoFocus = false, className }: CalendarProps) {
  const today = useIstToday();
  const reduce = useReducedMotion();
  const rules: DateRules = { min: minDate, max: maxDate, disabled: disabledDates };
  const start = value ?? minDate ?? null;
  const [month, setMonthState] = useControllable<DateKey | null>(monthProp ? monthOf(monthProp) : undefined, start ? monthOf(start) : null, (m) => m && onMonthChange?.(m));
  const [direction, setDirection] = useState(0);
  const [focused, setFocused] = useState<DateKey | null>(value ?? null);
  const grid = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  const moved = useRef(autoFocus);
  const groupId = useId();
  const labelId = useId();

  // With no value or minDate, open on today's month once it's known in the browser.
  const visible = month ?? (today ? monthOf(today) : null);

  useEffect(() => {
    if (!moved.current) return;
    // A frame later, so a popover's own open-focus has run first.
    const frame = requestAnimationFrame(() => {
      const el = grid.current;
      (el?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`) ?? el?.querySelector<HTMLButtonElement>('[tabindex="0"]'))?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [focused, visible]);

  const ready = visible !== null;
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  if (!visible) return <div className={cn("aspect-[7/7.6] w-[min(100%,328px)]", className)} aria-hidden />;

  const { offset, days, rows } = monthGrid(visible);
  const label = monthLabel(visible);
  const minMonth = minDate ? monthOf(minDate) : null;
  const maxMonth = maxDate ? monthOf(maxDate) : null;
  const canPrev = !minMonth || visible > minMonth;
  const canNext = !maxMonth || visible < maxMonth;
  const tabStop = days.find((d) => d === focused) ?? days.find((d) => d === value) ?? days.find((d) => d === today && isSelectable(d, rules)) ?? days.find((d) => isSelectable(d, rules));

  function goMonth(target: DateKey) {
    const m = monthOf(target);
    if (m === visible) return;
    setDirection(m > visible! ? 1 : -1);
    setMonthState(m);
  }

  function focusDay(day: DateKey | null) {
    if (!day) return;
    moved.current = true;
    setFocused(day);
    goMonth(day);
  }

  function pick(day: DateKey) {
    if (!isSelectable(day, rules)) return;
    setFocused(day);
    onChange?.(day);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, day: DateKey) {
    const weekday = (days.indexOf(day) + offset) % 7;
    const steps: Record<string, number | undefined> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday };
    if (e.key in steps) {
      e.preventDefault();
      const step = steps[e.key] ?? 0;
      if (step) focusDay(moveDay(day, step, rules));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const target = shiftMonths(day, (e.key === "PageUp" ? -1 : 1) * (e.shiftKey ? 12 : 1));
      focusDay(isSelectable(target, rules) ? target : moveDay(target, e.key === "PageUp" ? -1 : 1, rules) ?? moveDay(target, e.key === "PageUp" ? 1 : -1, rules));
    }
  }

  const slide = reduce
    ? { initial: false as const, animate: { x: 0, opacity: 1 }, exit: { opacity: 0, transition: { duration: 0 } } }
    : {
        initial: { x: `${direction * 40}%`, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: `${direction * -40}%`, opacity: 0 },
        transition: { type: "spring" as const, stiffness: 420, damping: 38 },
      };

  return (
    <section ref={root} className={cn("w-[min(100%,328px)] select-none", className)} aria-labelledby={labelId}>
      <div className="mb-2 flex items-center justify-between gap-2 pl-1.5">
        <h2 id={labelId} className="relative flex h-6 min-w-0 items-center overflow-hidden text-[14px] font-semibold">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.span
              key={visible}
              initial={reduce ? false : { y: direction >= 0 ? 14 : -14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { y: direction >= 0 ? -14 : 14, opacity: 0 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 36 }}
              className="whitespace-nowrap"
            >
              {label.name} <span className="font-normal text-muted tabular-nums">{label.year}</span>
            </motion.span>
          </AnimatePresence>
        </h2>
        <span className="sr-only" aria-live="polite">
          {label.name} {label.year}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          {showToday && today && (
            <button
              type="button"
              onClick={() => {
                goMonth(today);
                if (isSelectable(today, rules)) pick(today);
              }}
              className="mr-1 h-7 rounded-lg px-2 text-xs font-medium text-muted hover:bg-hover hover:text-ink"
            >
              Today
            </button>
          )}
          <NavButton label="Previous month" disabled={!canPrev} onClick={() => canPrev && goMonth(addMonths(visible, -1))}>
            <ChevronLeft />
          </NavButton>
          <NavButton label="Next month" disabled={!canNext} onClick={() => canNext && goMonth(addMonths(visible, 1))}>
            <ChevronRight />
          </NavButton>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 pb-1" aria-hidden>
        {WEEKDAY_LETTERS.map((d) => (
          <span key={d} className="text-center text-[11px] font-medium text-muted">
            {d}
          </span>
        ))}
      </div>

      <motion.div
        className="relative overflow-hidden"
        // Height follows the row count (4–6), so the grid morphs instead of jumping.
        animate={{ height: width ? (rows * (width - 12)) / 7 + (rows - 1) * 2 : "auto" }}
        initial={false}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 40 }}
      >
        <LayoutGroup id={groupId}>
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div key={visible} ref={grid} role="grid" aria-labelledby={labelId} className="grid grid-cols-7 gap-0.5" {...slide}>
              {Array.from({ length: rows }, (_, r) => (
                <div key={r} role="row" className="contents">
                  {Array.from({ length: 7 }, (_, c) => {
                    const day = days[r * 7 + c - offset];
                    if (!day) return <span key={c} role="gridcell" aria-hidden className="aspect-square" />;
                    const open = isSelectable(day, rules);
                    const selected = day === value;
                    const isToday = day === today;
                    return (
                      <span key={c} role="gridcell" aria-selected={selected} className="aspect-square">
                        <button
                          type="button"
                          data-day={day}
                          tabIndex={day === tabStop ? 0 : -1}
                          disabled={!open}
                          aria-current={isToday ? "date" : undefined}
                          aria-label={`${formatDate(day, { year: true })}${isToday ? ", today" : ""}${open ? "" : ", unavailable"}`}
                          onClick={() => pick(day)}
                          onKeyDown={(e) => onKeyDown(e, day)}
                          onFocus={() => setFocused(day)}
                          className={cn(
                            "relative isolate flex size-full items-center justify-center rounded-lg text-[13px] tabular-nums outline-none transition-colors",
                            "focus-visible:ring-2 focus-visible:ring-accent/40",
                            open ? (selected ? "font-semibold text-white" : "text-ink hover:bg-hover") : "cursor-not-allowed text-muted/45 line-through decoration-muted/30",
                          )}
                        >
                          {selected && (
                            <motion.span
                              layoutId="calendar-selection"
                              aria-hidden
                              transition={reduce ? { duration: 0 } : PILL_SPRING}
                              className="absolute inset-0 -z-10 rounded-lg bg-accent shadow-[0_1px_2px_rgb(0_0_0/0.15)]"
                            />
                          )}
                          {parseDateKey(day)?.day}
                          {isToday && <span aria-hidden className={cn("absolute bottom-1 size-1 rounded-full", selected ? "bg-white" : "bg-accent")} />}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </LayoutGroup>
      </motion.div>
    </section>
  );
}

function NavButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={onClick}
      className="inline-flex size-7 items-center justify-center rounded-lg text-muted outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40 aria-disabled:pointer-events-none aria-disabled:opacity-35 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

/* ---------- DateField: an input-styled trigger that opens the calendar ---------- */

export type DateFieldProps = {
  value?: DateKey | "";
  defaultValue?: DateKey | "";
  onChange?: (date: DateKey | "") => void;
  /** Hidden input name, for plain HTML forms. */
  name?: string;
  minDate?: DateKey;
  maxDate?: DateKey;
  disabledDates?: (date: DateKey) => boolean;
  placeholder?: string;
  /** Show a clear button when a date is set. */
  clearable?: boolean;
  disabled?: boolean;
  size?: "sm" | "app" | "touch";
  align?: "start" | "center" | "end";
  className?: string;
  id?: string;
  "aria-label"?: string;
};

export function DateField({
  value,
  defaultValue = "",
  onChange,
  name,
  minDate,
  maxDate,
  disabledDates,
  placeholder = "Pick a date",
  clearable = false,
  disabled,
  size = "app",
  align = "start",
  className,
  id,
  "aria-label": ariaLabel,
}: DateFieldProps) {
  const [current, setCurrent] = useControllable<DateKey | "">(value, defaultValue, onChange);
  const [open, setOpen] = useState(false);
  const field = useFieldProps({ id });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={ariaLabel ? `${ariaLabel}${current ? `: ${formatDate(current, { year: true })}` : ""}` : undefined}
            {...field.props}
            className={cn(
              inputVariants({ size: "app" }),
              "flex items-center gap-2 text-left data-[state=open]:border-accent data-[state=open]:ring-3 data-[state=open]:ring-accent/15",
              size === "sm" && "h-7 px-2 text-xs",
              size === "touch" && "h-11 rounded-xl px-3 text-[15px]",
              clearable && current && "pr-8",
            )}
          >
            <CalendarDays aria-hidden className={cn("shrink-0 text-muted", size === "sm" ? "size-3.5" : "size-4")} />
            <span className={cn("min-w-0 truncate", !current && "text-muted/70")}>{current ? formatDate(current, { year: true }) : placeholder}</span>
          </button>
        </PopoverTrigger>
        {clearable && current && !disabled && (
          <button
            type="button"
            aria-label="Clear date"
            onClick={() => setCurrent("")}
            className="absolute inset-y-0 right-1 my-auto inline-flex size-6 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      {name && <input type="hidden" name={name} value={current} />}
      <PopoverContent align={align} className="w-auto bg-surface! p-2.5 shadow-[var(--shadow-layer)]">
        <Calendar
          value={current || null}
          onChange={(d) => {
            setCurrent(d);
            setOpen(false);
          }}
          minDate={minDate}
          maxDate={maxDate}
          disabledDates={disabledDates}
          showToday
          autoFocus
          className="w-[296px]"
        />
      </PopoverContent>
    </Popover>
  );
}
