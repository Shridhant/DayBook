import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Accent, DisplayTitle, Muted } from "@/components/ui/page-section";
import { Rating } from "@/components/ui/rating";
import { Reveal } from "@/components/ui/reveal";
import { site } from "@/lib/site";
import type { Catalog, CatalogStaff } from "@/server/catalog";
import type { PortfolioItem } from "@/server/content";

const MAX_FACES = 4;

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
}

/**
 * Hero panel: headline left, lead + buttons right, then one wide rounded photo with a line of
 * text, the artists' faces and the service categories over it. The photo is the LCP element:
 * eager + high fetch priority (Next 16 deprecates `priority`).
 */
export function Hero({
  image,
  staff,
  categories,
}: {
  image: PortfolioItem | undefined;
  staff: CatalogStaff[];
  categories: Catalog["categories"];
}) {
  const showRating = site.googleRating !== null && site.googleReviewCount !== null;
  const faces = staff.slice(0, MAX_FACES);

  return (
    <section id="hero" className="pt-1 pb-1.5 md:pb-2.5">
      <div className="mx-auto w-full max-w-[1280px] px-2 sm:px-4 lg:px-6">
        <div className="rounded-[24px] bg-surface p-2 md:rounded-[32px] md:p-3">
          <div className="grid gap-6 px-2 pt-8 pb-8 sm:px-4 md:grid-cols-[1.4fr_1fr] md:items-end md:gap-10 md:px-7 md:pt-12 md:pb-10 lg:px-9">
            <Reveal index={0}>
              <p className="mb-4 text-[14px] text-muted">{site.tagline}</p>
              <DisplayTitle>
                {site.headline.before} <Accent>{site.headline.highlight}</Accent>
                {site.headline.after} <Muted className="block">Booked in a minute.</Muted>
              </DisplayTitle>
            </Reveal>
            <Reveal index={1} className="flex flex-col gap-5 md:items-end md:text-right">
              <p className="max-w-[40ch] text-[16px] leading-relaxed text-muted">
                Gel, extensions and hand-painted nail art by artists who sweat the details. Pick your artist and your time, and pay a
                small amount to hold it.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="primary" size="pub-md">
                  <Link href="/book">
                    Book now <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="pub-md">
                  <a href="#work">See our work</a>
                </Button>
              </div>
              {showRating && (
                <a
                  href={site.googleReviewsUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[14px] text-muted hover:text-ink"
                >
                  <Rating value={site.googleRating ?? 0} size={14} />
                  <span className="font-medium text-ink tabular-nums">{site.googleRating}</span>
                  on Google · {site.googleReviewCount?.toLocaleString("en-IN")} reviews
                </a>
              )}
            </Reveal>
          </div>

          <div className="relative aspect-[4/5] overflow-hidden rounded-[20px] bg-canvas sm:aspect-[16/10] md:rounded-[24px] lg:aspect-[2.2/1]">
            {image ? (
              <Image
                src={image.imagePath}
                alt={image.alt}
                fill
                loading="eager"
                fetchPriority="high"
                sizes="(min-width: 1280px) 1240px, 100vw"
                className="object-cover object-[50%_60%]"
              />
            ) : (
              <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--accent-soft),var(--subtle)_70%)]" />
            )}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-5 p-5 md:flex-row md:items-end md:justify-between md:p-8">
              <div>
                <p className="max-w-[14ch] text-[clamp(1.75rem,5vw,3.25rem)] leading-[1.05] font-medium tracking-[-0.03em] text-white">
                  Here for your nails.
                </p>
                {faces.length > 0 && (
                  <a href="#team" className="mt-4 flex items-center gap-3 text-[14px] text-white/90 hover:text-white">
                    <span className="flex -space-x-2.5">
                      {faces.map((s) => (
                        <span
                          key={s.id}
                          className="relative grid size-9 place-items-center overflow-hidden rounded-full bg-accent-soft text-[12px] font-semibold text-accent-hover ring-2 ring-white md:size-10"
                        >
                          {s.photoPath ? <Image src={s.photoPath} alt="" fill sizes="40px" className="object-cover" /> : initials(s.name)}
                        </span>
                      ))}
                    </span>
                    Meet our {staff.length} artists
                  </a>
                )}
              </div>
              {categories.length > 0 && (
                <ul className="flex max-w-[420px] flex-wrap gap-1.5 md:justify-end" aria-label="Services">
                  {categories.map((c) => (
                    <li key={c.id}>
                      <a
                        href="#services"
                        className="block rounded-full bg-white/20 px-3 py-1.5 text-[13px] text-white ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-white/30"
                      >
                        {c.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
