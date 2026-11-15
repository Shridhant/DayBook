/**
 * Public salon details shown on the site. Safe for client components (no secrets).
 * Fill these in with the salon's real details; empty values hide the related buttons.
 */
export const site = {
  name: "Daybook",
  tagline: "Nail studio · Delhi NCR",
  /** WhatsApp number in international format without "+", e.g. "919876543210". Empty hides WhatsApp links. */
  whatsapp: "",
  /** Phone for tel: links, e.g. "+91 98765 43210". */
  phone: "",
  /** Single-line address for calendar invites and the Visit section. */
  address: "",
} as const;

export function whatsappLink(message: string): string | null {
  if (!site.whatsapp) return null;
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;
}
