"use client";

import { MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Muted, PageSection, SectionHeader } from "@/components/ui/page-section";
import { site, telLink, whatsappLink } from "@/lib/site";
import { formatTime, istToday, weekdayOf, type Weekday } from "@/lib/time";
import { useIsClient } from "@/lib/use-is-client";
import { cn } from "@/lib/utils";
import type { Catalog } from "@/server/catalog";

// Monday-first, as people read a week.
const WEEK: { day: Weekday; label: string }[] = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
];

/** DESIGN.md §11.3 (8): hours (today highlighted), contact buttons, lazy map. */
export function VisitSection({ openingHours }: { openingHours: Catalog["openingHours"] }) {
  const isClient = useIsClient();
  const today = isClient ? weekdayOf(istToday()) : null; // time-dependent, so client only
  const whatsapp = whatsappLink("Hi! I'd like to know more about booking.");
  const tel = telLink();

  return (
    <PageSection id="visit" className="scroll-mt-16">
      <SectionHeader
        eyebrow="Visit"
        title={
          <>
            Come say hi, <Muted>or call ahead.</Muted>
          </>
        }
      />
      {/* With a map: hours and contact on the left, map on the right. Without one, the hours span
          the panel (one row of days on laptops) instead of leaving the right half empty. */}
      <div className={cn("grid gap-10", site.address && "lg:grid-cols-2")}>
        <div>
          {site.address && (
            <p className="flex items-start gap-3 text-[17px]">
              <MapPin aria-hidden className="mt-1 size-5 shrink-0 text-accent-hover" />
              {site.address}
            </p>
          )}

          <OpeningHours openingHours={openingHours} today={today} across={!site.address} className={cn(site.address && "mt-6")} />

          {(whatsapp || tel || site.mapsUrl) && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {whatsapp && (
                <Button asChild variant="primary" size="pub-md">
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                    <MessageCircle /> WhatsApp us
                  </a>
                </Button>
              )}
              {site.mapsUrl && (
                <Button asChild size="pub-md">
                  <a href={site.mapsUrl} target="_blank" rel="noopener noreferrer">
                    <Navigation /> Get directions
                  </a>
                </Button>
              )}
              {tel && (
                <Button asChild size="pub-md">
                  <a href={tel}>
                    <Phone /> Call
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>

        {site.address && <LazyMap address={site.address} />}
      </div>
    </PageSection>
  );
}

/**
 * Opening hours, today highlighted. A list with row lines on phones (and beside the map); with
 * `across`, one tile per day in a single row from lg, so the week reads left to right.
 */
function OpeningHours({
  openingHours,
  today,
  across,
  className,
}: {
  openingHours: Catalog["openingHours"];
  today: Weekday | null;
  across: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="sr-only">Opening hours (India time)</h3>
      <dl className={cn("divide-y divide-line border-y border-line text-[15px]", across && "lg:grid lg:grid-cols-7 lg:gap-2 lg:divide-y-0 lg:border-0")}>
        {WEEK.map(({ day, label }) => {
          const hours = openingHours[day];
          const isToday = day === today;
          return (
            <div
              key={day}
              className={cn(
                "flex items-center justify-between gap-4 px-3 py-3",
                isToday && "rounded-lg bg-accent-soft",
                across && "lg:flex-col lg:items-start lg:justify-start lg:gap-1.5 lg:rounded-xl lg:border lg:border-line lg:p-4",
                across && isToday && "lg:border-accent-soft",
              )}
            >
              <dt className={cn("flex items-center gap-2", isToday && "font-medium")}>
                {label}
                {isToday && <TodayBadge className={cn(across && "lg:hidden")} />}
              </dt>
              <dd className={cn("text-right tabular-nums", across && "lg:text-left", !hours && "text-muted")}>
                {hours ? (
                  <>
                    {formatTime(hours.opens)}
                    {/* Tiles stack the times: "11:00 am" over "to 8:00 pm". */}
                    <span className={cn(across && "hidden")}> – </span>
                    {across && (
                      <>
                        <span className="lg:hidden"> – </span>
                        <span className="hidden text-muted lg:inline"> to</span>
                        <br className="hidden lg:block" />
                      </>
                    )}
                    {formatTime(hours.closes)}
                  </>
                ) : (
                  "Closed"
                )}
              </dd>
              {/* In a tile the badge sits under the hours, so every day's times line up. */}
              {isToday && across && <TodayBadge className="mt-1 hidden lg:inline-flex" />}
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function TodayBadge({ className }: { className?: string }) {
  return <span className={cn("inline-flex rounded-full bg-accent px-2 py-0.5 text-[12px] font-medium text-white", className)}>Today</span>;
}

/** Loads Google Maps only when the map scrolls near the viewport (DESIGN.md §11.7). */
function LazyMap({ address }: { address: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-hover md:aspect-[16/9] lg:aspect-auto lg:min-h-80">
      {load && (
        <iframe
          title={`Map showing ${address}`}
          src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </div>
  );
}
