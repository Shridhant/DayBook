"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addDays, isDateKey } from "@/lib/time";

/** Previous / today / next and a date picker, all driven by ?date= so views are linkable. */
export function DayNav({ date, today, basePath }: { date: string; today: string; basePath: string }) {
  const router = useRouter();
  const href = (d: string) => `${basePath}?date=${d}`;
  return (
    <div className="flex items-center gap-1.5">
      <Button asChild size="icon" aria-label="Previous day">
        <Link href={href(addDays(date, -1))}>
          <ChevronLeft />
        </Link>
      </Button>
      <Button asChild size="sm" variant={date === today ? "muted" : "secondary"}>
        <Link href={href(today)}>Today</Link>
      </Button>
      <Button asChild size="icon" aria-label="Next day">
        <Link href={href(addDays(date, 1))}>
          <ChevronRight />
        </Link>
      </Button>
      <input
        type="date"
        aria-label="Pick a date"
        value={date}
        onChange={(e) => isDateKey(e.target.value) && router.push(href(e.target.value))}
        className="h-7 rounded-lg border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-accent focus:ring-3 focus:ring-accent/15"
      />
    </div>
  );
}
