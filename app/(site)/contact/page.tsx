import type { Metadata } from "next";
import Link from "next/link";
import { businessName, ContactLines, LegalPage } from "@/components/site/legal-page";
import { site } from "@/lib/site";
import { formatTime, type Weekday } from "@/lib/time";
import { getCatalog } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Contact us",
  description: `How to reach ${site.name}: address, phone, WhatsApp, email and opening hours.`,
};

const WEEK: { day: Weekday; label: string }[] = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
];

export default async function ContactPage() {
  const { openingHours } = await getCatalog();
  return (
    <LegalPage
      title="Contact us"
      updated="16 November 2026"
      intro={
        <p>
          Questions about a booking, prices or a design you have in mind? We&apos;re happy to help. For a booking, have your reference
          (it starts with &quot;DB-&quot;) handy.
        </p>
      }
    >
      <h2>{businessName()}</h2>
      <ContactLines />
      {site.mapsUrl && (
        <p>
          <a href={site.mapsUrl} target="_blank" rel="noopener noreferrer">
            Get directions on Google Maps
          </a>
        </p>
      )}

      <h2>Opening hours</h2>
      <ul>
        {WEEK.map(({ day, label }) => {
          const h = openingHours[day];
          return (
            <li key={day}>
              {label}: {h ? `${formatTime(h.opens)} – ${formatTime(h.closes)}` : "Closed"}
            </li>
          );
        })}
      </ul>

      <h2>Book online</h2>
      <p>
        The quickest way to get an appointment is to <Link href="/book">book online</Link>. You&apos;ll see live availability and get an
        instant confirmation.
      </p>
    </LegalPage>
  );
}
