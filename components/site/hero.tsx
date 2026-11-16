import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Accent, Container, DisplayTitle, Eyebrow, Lead } from "@/components/ui/page-section";
import { Rating } from "@/components/ui/rating";
import { Reveal } from "@/components/ui/reveal";
import { site } from "@/lib/site";
import type { PortfolioItem } from "@/server/content";

/**
 * DESIGN.md §11.3 (2). Text stack + a 4:5 photo or an offset two-photo collage.
 * The first image is the LCP element: eager + high fetch priority (Next 16 deprecates `priority`).
 */
export function Hero({ images }: { images: PortfolioItem[] }) {
  const [main, second] = images;
  const showRating = site.googleRating !== null && site.googleReviewCount !== null;

  return (
    <section id="hero" className="bg-surface pt-6 pb-16 md:pt-12 md:pb-24">
      <Container className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <Reveal index={0}>
            <Eyebrow>{site.tagline}</Eyebrow>
          </Reveal>
          <Reveal index={1}>
            <DisplayTitle className="mt-3">
              {site.headline.before} <Accent>{site.headline.highlight}</Accent>
              {site.headline.after}
            </DisplayTitle>
          </Reveal>
          <Reveal index={2}>
            <Lead className="mt-5">
              Gel, extensions and hand-painted nail art by artists who sweat the details. Pick your artist and book online in under a
              minute.
            </Lead>
          </Reveal>
          <Reveal index={3}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="primary" size="pub-lg">
                <Link href="/book">Book an appointment</Link>
              </Button>
              <Button asChild size="pub-lg">
                <a href="#work">See our work</a>
              </Button>
            </div>
          </Reveal>
          {showRating && (
            <Reveal index={4}>
              <a
                href={site.googleReviewsUrl || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 text-[14px] text-muted hover:text-ink"
              >
                <Rating value={site.googleRating ?? 0} />
                <span className="font-medium text-ink tabular-nums">{site.googleRating}</span>
                on Google · {site.googleReviewCount?.toLocaleString("en-IN")} reviews
              </a>
            </Reveal>
          )}
        </div>

        <div className="lg:col-span-7">
          {main ? (
            <div className="relative">
              <div className={second ? "w-[78%] sm:w-[70%]" : "mx-auto max-w-md lg:max-w-none"}>
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-canvas">
                  <Image src={main.imagePath} alt={main.alt} fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 40vw, 80vw" className="object-cover" />
                </div>
              </div>
              {second && (
                <div className="absolute right-0 bottom-[-8%] w-[46%] sm:w-[40%]">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border-4 border-surface bg-canvas shadow-[var(--shadow-layer)]">
                    <Image src={second.imagePath} alt={second.alt} fill loading="eager" sizes="(min-width: 1024px) 25vw, 45vw" className="object-cover" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div aria-hidden className="aspect-[4/5] rounded-2xl bg-[radial-gradient(circle_at_30%_20%,var(--accent-soft),var(--subtle)_70%)]" />
          )}
        </div>
      </Container>
    </section>
  );
}
