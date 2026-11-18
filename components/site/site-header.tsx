"use client";

import { Menu as MenuIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/dialog";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "./nav-links";

/** DESIGN.md §11.3 (1): sticky header that gains glass + border once the page scrolls. */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-200",
        scrolled ? "border-b border-line bg-canvas/85 backdrop-blur-md" : "border-b border-transparent bg-canvas",
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 md:h-16 lg:px-8">
        <Link
          href="/"
          className="-ml-1 flex items-center rounded-full px-1 text-[18px] font-semibold tracking-[-0.02em] outline-none focus-visible:ring-3 focus-visible:ring-brand/30"
        >
          {site.logo ? (
            // Above the fold on every page: load it straight away.
            <Image
              src={site.logo.wordmark.src}
              alt={site.name}
              width={site.logo.wordmark.width}
              height={site.logo.wordmark.height}
              loading="eager"
              className="h-9 w-auto md:h-10"
            />
          ) : (
            site.name
          )}
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="rounded-full px-3.5 py-2 text-[15px] text-ink/70 transition-colors outline-none hover:bg-hover hover:text-ink focus-visible:ring-3 focus-visible:ring-brand/30"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          <Button asChild variant="primary" size="pub-sm">
            <Link href="/book">Book now</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="pub-icon" className="md:hidden" aria-label="Open menu">
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" title="Menu" hideTitle>
              <nav aria-label="Mobile" className="flex h-full flex-col">
                <ul className="flex-1">
                  {NAV_LINKS.map((l) => (
                    <li key={l.href}>
                      <SheetClose asChild>
                        <a href={l.href} className="block rounded-xl px-2 py-3 text-[20px] font-medium tracking-[-0.01em] hover:bg-hover">
                          {l.label}
                        </a>
                      </SheetClose>
                    </li>
                  ))}
                </ul>
                <SheetClose asChild>
                  <Button asChild variant="primary" size="pub-lg" block>
                    <Link href="/book">Book an appointment</Link>
                  </Button>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
