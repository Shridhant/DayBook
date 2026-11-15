import Link from "next/link";
import { site, telLink, whatsappLink } from "@/lib/site";
import { NAV_LINKS } from "./nav-links";

/** DESIGN.md §11.3 (10). Server component; links that need missing site details are hidden. */
export function SiteFooter() {
  const whatsapp = whatsappLink("Hi! I have a question.");
  const tel = telLink();

  return (
    <footer id="site-footer" className="bg-canvas">
      <div className="container-page grid gap-10 py-14 md:grid-cols-3">
        <div>
          <p className="text-[18px] font-semibold tracking-[-0.02em]">{site.name}</p>
          <p className="mt-2 max-w-xs text-[15px] text-muted">{site.tagline}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-y-2 text-[15px]">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="text-ink/80 hover:text-ink">
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <Link href="/book" className="text-ink/80 hover:text-ink">
                Book online
              </Link>
            </li>
          </ul>
        </nav>
        <ul className="space-y-2 text-[15px]">
          {site.address && <li className="text-muted">{site.address}</li>}
          {tel && (
            <li>
              <a href={tel} className="text-ink/80 hover:text-ink">
                {site.phone}
              </a>
            </li>
          )}
          {whatsapp && (
            <li>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="text-ink/80 hover:text-ink">
                WhatsApp
              </a>
            </li>
          )}
          {site.instagramUrl && (
            <li>
              <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-ink/80 hover:text-ink">
                Instagram
              </a>
            </li>
          )}
        </ul>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-3 py-5 text-[13px] text-muted md:flex-row md:items-center md:justify-between">
          <p>© {site.legalName || site.name}. The amount you pay online to book is adjusted against your final bill.</p>
          <nav aria-label="Policies">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {[
                ["/contact", "Contact"],
                ["/cancellation-policy", "Cancellation & refunds"],
                ["/terms", "Terms"],
                ["/privacy", "Privacy"],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-ink">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
