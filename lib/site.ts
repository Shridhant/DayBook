/**
 * The salon's identity: the one file to edit when setting Daybook up for a new salon (name,
 * colours, headline, contact details). Safe for client components (no secrets). Services, prices,
 * artists, photos and reviews are edited in the admin instead.
 *
 * Fill these in with the salon's REAL details. Anything left empty/null hides the matching
 * button, badge or section, so the site never shows made-up facts.
 */
type Hex = `#${string}`;

type SiteConfig = {
  name: string;
  colors: {
    /** Bright highlight: headline word, dots, underlines. */
    brand: Hex;
    /** Button fill. Must keep white text readable (contrast 4.5:1 or more). */
    accent: Hex;
    /** Small coloured text on the light background (eyebrows, links). A darker shade of `accent`. */
    accentDeep: Hex;
    /** Pale tint for selected rows and soft backgrounds. */
    accentSoft: Hex;
  };
  /**
   * Logo files, made from the salon's logo by `npm run brand:icons` (which also writes the favicon).
   * `wordmark` is shown in the site header; `mark` is the square tile in the admin. null shows the
   * name (header) or its first letter (admin) instead.
   */
  logo: { wordmark: { src: string; width: number; height: number }; mark: string } | null;
  /** Hero headline: the `highlight` word is shown in the brand colour. */
  headline: { before: string; highlight: string; after: string };
  /** Wide hero photo in public/ (landscape, ~1700px wide). null uses the first featured portfolio photo. */
  heroImage: { src: string; alt: string } | null;
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
  colors: { brand: "#FF00AA", accent: "#D6008F", accentDeep: "#B8007B", accentSoft: "#FFE6F5" },
  logo: { wordmark: { src: "/site/logo.png", width: 640, height: 266 }, mark: "/site/logo-mark.png" },
  headline: { before: "Nails, done", highlight: "beautifully", after: "." },
  heroImage: { src: "/site/banner.png", alt: "A client painting her nails on a pink bed, surrounded by beauty products" },
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

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * CSS that applies `site.colors` over the defaults in app/globals.css (injected by the root
 * layout). The selectors are more specific than `:root` / `.dark`, so it wins whatever the order.
 */
export function brandCss(colors: SiteConfig["colors"] = site.colors): string {
  for (const value of Object.values(colors)) {
    if (!HEX.test(value)) throw new Error(`lib/site.ts colours must be 6-digit hex like #D6008F (got ${value}).`);
  }
  const { brand, accent, accentDeep, accentSoft } = colors;
  return (
    `html:root:not(.dark){--brand:${brand};--accent:${accent};--accent-hover:${accentDeep};--accent-soft:${accentSoft}}` +
    `html.dark{--brand:${brand};--accent:${accent};--accent-hover:${brand};--accent-soft:color-mix(in srgb,${brand} 14%,transparent)}`
  );
}
