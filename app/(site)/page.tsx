import type { Metadata } from "next";
import { CtaBand } from "@/components/site/cta-band";
import { Hero } from "@/components/site/hero";
import { PortfolioSection } from "@/components/site/portfolio-section";
import { ReelsCarousel } from "@/components/site/reels";
import { ServicesSection } from "@/components/site/services-section";
import { StickyCta } from "@/components/site/sticky-cta";
import { TeamSection } from "@/components/site/team-section";
import { TestimonialsSection } from "@/components/site/testimonials-section";
import { VisitSection } from "@/components/site/visit-section";
import { PageSection, SectionHeader } from "@/components/ui/page-section";
import { site } from "@/lib/site";
import { minutesToTime } from "@/lib/time";
import { getCatalog, type Catalog } from "@/server/catalog";
import { getInstagramPosts, getPortfolio, getTestimonials } from "@/server/content";

export const metadata: Metadata = {
  title: { absolute: `${site.name} — ${site.tagline}` },
  description: "Gel, extensions and hand-painted nail art. See our work, meet the artists and book online in under a minute.",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** schema.org NailSalon for Google. Only facts we actually have are included. */
function jsonLd(catalog: Catalog) {
  return {
    "@context": "https://schema.org",
    "@type": "NailSalon",
    name: site.name,
    ...(site.phone && { telephone: site.phone }),
    ...(site.address && { address: site.address }),
    ...(site.instagramUrl && { sameAs: [site.instagramUrl] }),
    openingHoursSpecification: Object.entries(catalog.openingHours).map(([day, hours]) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DAY_NAMES[Number(day)],
      opens: minutesToTime(hours.opens),
      closes: minutesToTime(hours.closes),
    })),
    ...(site.googleRating !== null &&
      site.googleReviewCount !== null && {
        aggregateRating: { "@type": "AggregateRating", ratingValue: site.googleRating, reviewCount: site.googleReviewCount },
      }),
  };
}

export default async function HomePage() {
  const [catalog, portfolio, posts, testimonials] = await Promise.all([
    getCatalog(),
    getPortfolio(),
    getInstagramPosts(),
    getTestimonials(),
  ]);

  const heroImages = (portfolio.some((p) => p.featured) ? portfolio.filter((p) => p.featured) : portfolio).slice(0, 2);
  const reels = posts.filter((p) => p.placement !== "reviews");
  const reviewReels = posts.filter((p) => p.placement === "reviews");

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(catalog)).replace(/</g, "\\u003c") }} />
      <Hero images={heroImages} />
      <ServicesSection catalog={catalog} />
      <PortfolioSection items={portfolio} categories={catalog.categories} />
      {reels.length > 0 && (
        <PageSection tone="canvas">
          <SectionHeader eyebrow="Instagram" title="Fresh from the studio" lead="Tap a reel to watch it here." />
          <ReelsCarousel posts={reels} instagramUrl={site.instagramUrl} />
        </PageSection>
      )}
      <TeamSection staff={catalog.staff} />
      <TestimonialsSection testimonials={testimonials} reviewReels={reviewReels} />
      <VisitSection openingHours={catalog.openingHours} />
      <CtaBand />
      <StickyCta />
    </main>
  );
}
