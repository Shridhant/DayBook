"use client";

import { CalendarX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { DateTile, SlotChip } from "@/components/ui/choice";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, formatDate, formatMonthShort, formatWeekdayShort, istToday, parseDateKey, weekdayOf } from "@/lib/time";
import { useIsClient } from "@/lib/use-is-client";
import type { Catalog } from "@/server/catalog";
import { ApiError, fetchAvailability, type AvailabilityDto, type SlotDto } from "./api";
import { StepHeading } from "./step-heading";

const GROUPS = [
  { label: "Morning", test: (m: number) => m < 720 },
  { label: "Afternoon", test: (m: number) => m >= 720 && m < 1020 },
  { label: "Evening", test: (m: number) => m >= 1020 },
] as const;

const closedMessages: Record<NonNullable<AvailabilityDto["closedReason"]>, string> = {
  past: "That day has passed. Pick another date.",
  outside_window: "We don't take bookings that far ahead yet.",
  closed: "The studio is closed that day.",
  no_staff: "No artist can do this combination of services.",
};

type Result = { key: string; data?: AvailabilityDto; error?: string };

export function TimeStep({
  catalog,
  serviceIds,
  staffId,
  date,
  slotMinutes,
  refreshKey,
  notice,
  onPick,
  onDate,
  fetcher = fetchAvailability,
  title = "When suits you?",
}: {
  catalog: Catalog;
  serviceIds: string[];
  staffId: string | null;
  date: string | null;
  slotMinutes: number | null;
  /** Bump to refetch (e.g. after "someone just booked that time"). */
  refreshKey: number;
  notice: string | null;
  onPick: (date: string, slot: SlotDto) => void;
  onDate: (date: string) => void;
  /** Where times come from (the manage page loads them for an existing booking). */
  fetcher?: (params: { date: string; serviceIds: string[]; staffId: string | null }, signal?: AbortSignal) => Promise<AvailabilityDto>;
  title?: string;
}) {
  const isClient = useIsClient();

  // Dates depend on "today", so they're only computed in the browser.
  const days = useMemo(() => {
    if (!isClient) return [];
    const today = istToday();
    const closures = new Set(catalog.closures);
    return Array.from({ length: catalog.bookingWindowDays }, (_, i) => {
      const key = addDays(today, i);
      return { key, closed: !catalog.openingHours[weekdayOf(key)] || closures.has(key) };
    });
  }, [isClient, catalog]);

  const activeDate = date ?? days.find((d) => !d.closed)?.key ?? null;
  const requestKey = activeDate ? JSON.stringify([activeDate, serviceIds, staffId, refreshKey]) : null;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!activeDate || !requestKey) return;
    const controller = new AbortController();
    fetcher({ date: activeDate, serviceIds, staffId }, controller.signal)
      .then((data) => setResult({ key: requestKey, data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, error: error instanceof ApiError ? error.message : "Couldn't load times. Please try again." });
      });
    return () => controller.abort();
    // serviceIds/staffId/refreshKey are captured in requestKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const loading = !result || result.key !== requestKey;
  const data = loading ? undefined : result.data;
  const error = loading ? undefined : result.error;

  return (
    <section aria-labelledby="step-time">
      <StepHeading id="step-time" title={title} hint="Times are shown in India time (IST)." />

      {notice && (
        <Alert tone="warning" className="mt-6">
          {notice}
        </Alert>
      )}

      <div className="no-scrollbar -mx-4 mt-6 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:scroll-px-0 sm:px-0" role="group" aria-label="Choose a date">
        {days.length === 0
          ? Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-[72px] w-16 shrink-0 rounded-xl" />)
          : days.map((d) => (
              <DateTile
                key={d.key}
                weekday={formatWeekdayShort(d.key)}
                day={parseDateKey(d.key)?.day ?? ""}
                month={formatMonthShort(d.key)}
                selected={d.key === activeDate}
                disabled={d.closed}
                aria-label={`${formatDate(d.key)}${d.closed ? " (closed)" : ""}`}
                onClick={() => onDate(d.key)}
              />
            ))}
      </div>

      <div className="mt-6 min-h-48" aria-live="polite" aria-busy={loading}>
        {loading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-11 rounded-full" />
            ))}
          </div>
        ) : error ? (
          <Alert tone="danger">{error}</Alert>
        ) : data?.closedReason ? (
          <EmptyDay message={closedMessages[data.closedReason]} />
        ) : !data || data.slots.length === 0 ? (
          <EmptyDay
            message={
              activeDate === istToday()
                ? "No more times left today. Pick another date."
                : `Fully booked on ${activeDate ? formatDate(activeDate) : "this day"}. Try another date${staffId ? " or 'Any available'" : ""}.`
            }
          />
        ) : (
          <div className="space-y-5">
            {GROUPS.map((group) => {
              const slots = data.slots.filter((s) => group.test(s.minutes));
              if (slots.length === 0) return null;
              return (
                <div key={group.label}>
                  <p className="text-[12px] font-medium tracking-[0.12em] text-accent-hover uppercase">{group.label}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((slot) => (
                      <SlotChip
                        key={slot.minutes}
                        selected={date === activeDate && slotMinutes === slot.minutes}
                        onClick={() => activeDate && onPick(activeDate, slot)}
                      >
                        {slot.label}
                      </SlotChip>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyDay({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-10 text-center text-muted">
      <CalendarX aria-hidden className="size-6" />
      <p className="mt-2 max-w-sm text-[15px]">{message}</p>
    </div>
  );
}
