import Image from "next/image";
import Link from "next/link";
import { PageSection, SectionHeader } from "@/components/ui/page-section";
import { Reveal } from "@/components/ui/reveal";
import type { CatalogStaff } from "@/server/catalog";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
}

/** DESIGN.md §11.3 (6): staff cards linking to booking with that artist preselected. */
export function TeamSection({ staff }: { staff: CatalogStaff[] }) {
  if (staff.length === 0) return null;
  return (
    <PageSection id="team" tone="canvas" className="scroll-mt-16">
      <SectionHeader eyebrow="Team" title="Meet the artists" lead="Book your favourite, or let us match you with whoever is free first." />
      <ul className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
        {staff.map((s, i) => (
          <Reveal key={s.id} as="li" index={i}>
            <Link
              href={`/book?staff=${s.slug}`}
              className="group block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-brand/40"
              aria-label={`Book with ${s.name}`}
            >
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-hover">
                {s.photoPath ? (
                  <Image
                    src={s.photoPath}
                    alt={s.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-[1.03]"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_25%,var(--accent-soft),var(--hover)_75%)] text-[40px] font-semibold tracking-[-0.03em] text-accent-hover/70"
                  >
                    {initials(s.name)}
                  </span>
                )}
              </div>
              <h3 className="mt-3 text-[18px] font-semibold tracking-[-0.01em]">{s.name}</h3>
              {s.specialties && <p className="text-[14px] text-muted">{s.specialties}</p>}
              <p className="mt-1 text-[14px] font-medium text-accent-hover [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-visible:opacity-100">
                Book with {s.name.split(" ")[0]} →
              </p>
            </Link>
          </Reveal>
        ))}
      </ul>
    </PageSection>
  );
}
