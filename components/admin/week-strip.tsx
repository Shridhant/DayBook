import Link from "next/link";
import { addDays, formatDate, formatWeekdayShort, parseDateKey, weekdayOf, type DateKey } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Monday–Sunday around the shown day; today's number sits in an accent pill, like a phone calendar. */
export function WeekStrip({ date, today, basePath }: { date: DateKey; today: DateKey; basePath: string }) {
  const monday = addDays(date, -((weekdayOf(date) + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return (
    <nav aria-label="Week" className="mb-4 grid grid-cols-7 gap-1">
      {days.map((d) => {
        const selected = d === date;
        const isToday = d === today;
        return (
          <Link
            key={d}
            href={`${basePath}?date=${d}`}
            aria-current={selected ? "date" : undefined}
            aria-label={formatDate(d)}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 outline-none sm:flex-row sm:gap-2",
              "transition-colors hover:bg-hover focus-visible:ring-3 focus-visible:ring-accent/30",
              selected && "bg-hover",
            )}
          >
            <span className={cn("text-[12px] sm:text-[14px]", isToday ? "font-medium text-accent" : "text-muted")}>{formatWeekdayShort(d)}</span>
            <span
              className={cn(
                "grid h-7 min-w-7 place-items-center rounded-lg px-1 text-[14px] font-semibold tabular-nums sm:text-[16px]",
                isToday ? "bg-accent text-white" : "text-ink",
              )}
            >
              {parseDateKey(d)?.day}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
