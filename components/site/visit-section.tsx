"use client";

import { MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageSection, SectionHeader } from "@/components/ui/page-section";
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
    <PageSection id="visit" tone="canvas" className="scroll-mt-16">
      <SectionHeader eyebrow="Visit" title="Come say hi" />
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          {site.address && (
            <p className="flex items-start gap-3 text-[17px]">
              <MapPin aria-hidden className="mt-1 size-5 shrink-0 text-accent-hover" />
              {site.address}
            </p>
          )}

          <table className={cn("w-full max-w-md text-[15px]", site.address && "mt-6")}>
            <caption className="sr-only">Opening hours (India time)</caption>
            <tbody>
              {WEEK.map(({ day, label }) => {
                const hours = openingHours[day];
                const isToday = day === today;
                return (
                  <tr key={day} className={cn(isToday && "bg-accent-soft")}>
                    <th scope="row" className={cn("rounded-l-lg py-2 pl-3 text-left font-normal", isToday && "font-medium")}>
                      {label}
                      {isToday && <span className="ml-2 text-[13px] text-accent-hover">Today</span>}
                    </th>
                    <td className={cn("rounded-r-lg py-2 pr-3 text-right tabular-nums", !hours && "text-muted")}>
                      {hours ? `${formatTime(hours.opens)} – ${formatTime(hours.closes)}` : "Closed"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

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
