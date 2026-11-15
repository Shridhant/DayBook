/**
 * Public salon details shown on the site. Safe for client components (no secrets).
 *
 * Fill these in with the salon's REAL details. Anything left empty/null hides the matching
 * button, badge or section, so the site never shows made-up facts.
 */
type SiteConfig = {
  name: string;
  legalName: string;
  email: string;
  tagline: string;
  whatsapp: string;
  phone: string;
  address: string;
  mapsUrl: string;
  instagramUrl: string;
  googleRating: number | null;
  googleReviewCount: number | null;
  googleReviewsUrl: string;
};

export const site: SiteConfig = {
  name: "Daybook",
  /** Registered business name for the policy pages (Razorpay checks it). Falls back to `name`. */
  legalName: "",
  /** Public contact email shown on the Contact and policy pages. */
  email: "",
  /** Eyebrow line in the hero, e.g. "Nail studio · Gurugram". */
  tagline: "Nail studio · Delhi NCR",
  /** WhatsApp number in international format without "+", e.g. "919876543210". */
  whatsapp: "",
  /** Phone for tel: links, e.g. "+91 98765 43210". */
  phone: "",
  /** Single-line address for the Visit section, maps and calendar invites. */
  address: "",
  /** Google Maps link to the salon's listing (opens directions). */
  mapsUrl: "",
  /** Instagram profile URL, e.g. "https://www.instagram.com/yoursalon/". */
  instagramUrl: "",
  /** Google rating and review count, shown only when both are set. */
  googleRating: null,
  googleReviewCount: null,
  /** Link to the Google reviews page. */
  googleReviewsUrl: "",
};

export function whatsappLink(message: string): string | null {
  if (!site.whatsapp) return null;
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function telLink(): string | null {
  return site.phone ? `tel:${site.phone.replace(/[^\d+]/g, "")}` : null;
}
