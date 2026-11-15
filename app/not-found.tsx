import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { Accent, Container, DisplayTitle, Eyebrow, Lead } from "@/components/ui/page-section";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

const LINKS = [
  { href: "/#services", label: "Menu & prices" },
  { href: "/#work", label: "Our work" },
  { href: "/contact", label: "Contact us" },
];

/** Public 404 (DESIGN.md §11): same header/footer as the site, with clear ways forward. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="bg-surface">
        <Container className="flex min-h-[60dvh] flex-col justify-center py-16 md:py-24">
          <Eyebrow>Error 404</Eyebrow>
          <DisplayTitle className="mt-3 max-w-[14ch]">
            This page took a <Accent>day off</Accent>.
          </DisplayTitle>
          <Lead className="mt-5">The link may be old or mistyped. Everything else is open as usual.</Lead>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="primary" size="pub-lg">
              <Link href="/book">Book an appointment</Link>
            </Button>
            <Button asChild size="pub-lg">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
          <nav aria-label="Popular pages" className="mt-10">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-accent-hover underline decoration-brand/40 underline-offset-4 hover:decoration-brand">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
