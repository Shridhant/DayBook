import { Muted, PageSection, SectionHeader } from "@/components/ui/page-section";
import { Rating } from "@/components/ui/rating";
import { site } from "@/lib/site";
import type { InstagramPost, Testimonial } from "@/server/content";
import { ReelsCarousel } from "./reels";

/** DESIGN.md §11.3 (7): snap carousel on phones, 3-column grid on lg, optional review reels. */
export function TestimonialsSection({ testimonials, reviewReels }: { testimonials: Testimonial[]; reviewReels: InstagramPost[] }) {
  if (testimonials.length === 0 && reviewReels.length === 0) return null;
  const showGoogle = site.googleRating !== null && site.googleReviewCount !== null;

  return (
    <PageSection id="reviews" className="scroll-mt-16">
      <SectionHeader
        eyebrow="Reviews"
        align="center"
        title={
          <>
            Real clients, <Muted>real results.</Muted>
          </>
        }
        actions={
          showGoogle ? (
            <a
              href={site.googleReviewsUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[14px] hover:bg-hover"
            >
              <Rating value={site.googleRating ?? 0} size={14} />
              <span className="font-medium tabular-nums">{site.googleRating}</span>
              <span className="text-muted">on Google</span>
            </a>
          ) : undefined
        }
      />

      {testimonials.length > 0 && (
        <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:scroll-px-0 sm:px-0 lg:grid lg:grid-cols-3 lg:overflow-visible">
          {testimonials.map((t) => (
            <li key={t.id} className="w-[85vw] max-w-sm shrink-0 snap-start lg:w-auto lg:max-w-none">
              <figure className="flex h-full flex-col rounded-[20px] bg-canvas p-6 md:p-7">
                <span aria-hidden className="text-[44px] leading-none font-medium text-brand">
                  &ldquo;
                </span>
                <Rating value={t.rating} className="mt-2" />
                <blockquote className="mt-4 flex-1 text-[17px] leading-relaxed">{t.quote}</blockquote>
                <figcaption className="mt-5 text-[14px]">
                  <span className="font-medium">{t.name}</span>
                  {t.serviceLabel && <span className="text-muted"> · {t.serviceLabel}</span>}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}

      {reviewReels.length > 0 && (
        <div className={testimonials.length > 0 ? "mt-10" : undefined}>
          <ReelsCarousel posts={reviewReels} instagramUrl="" />
        </div>
      )}
    </PageSection>
  );
}
