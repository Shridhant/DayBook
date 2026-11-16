"use client";

import { ArrowRight, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Muted, PageSection, SectionHeader } from "@/components/ui/page-section";
import { Tabs } from "@/components/ui/tabs";
import { formatINR } from "@/lib/money";
import { formatDuration } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Catalog, CatalogService } from "@/server/catalog";

type Props = { catalog: Pick<Catalog, "categories" | "services"> };

/**
 * Tile spans by count, so 1–5 tiles always fill the grid (4 columns from `md`, 2 on phones):
 * the first is big (2×2); with 3 or 4 tiles the second is tall (1×2) like a magazine layout.
 */
function tileSpan(index: number, count: number): string {
  if (count <= 2) return "col-span-2 row-span-2";
  if (index === 0) return "col-span-2 row-span-2";
  if (index === 1 && count <= 4) return "row-span-2";
  if (index === 2 && count === 3) return "row-span-2";
  return "";
}

/**
 * Services panel: a photo tile for each category that has a cover photo (set in Services & prices
 * → Categories), then the menu for the chosen category as photo cards with price, duration and a
 * Book link.
 */
export function ServicesSection({ catalog }: Props) {
  const [category, setCategory] = useState(catalog.categories[0]?.id ?? "");
  const menu = useRef<HTMLDivElement>(null);
  const services = catalog.services.filter((s) => s.categoryId === category);

  if (catalog.categories.length === 0) return null;

  const tiles = catalog.categories.flatMap((c) => {
    const list = catalog.services.filter((s) => s.categoryId === c.id);
    return c.imagePath
      ? [
          {
            ...c,
            imagePath: c.imagePath,
            count: list.length,
            fromPaise: Math.min(...list.map((s) => s.pricePaise)),
          },
        ]
      : [];
  });

  function openCategory(id: string) {
    setCategory(id);
    menu.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <PageSection id="services" className="scroll-mt-16">
      <SectionHeader
        eyebrow="Services"
        title={
          <>
            Everything your nails need, <Muted>priced up front.</Muted>
          </>
        }
        lead="Clear prices, no surprises. Pay a small amount online to hold your slot; the rest at the studio."
        actions={
          <Button asChild size="pub-md">
            <Link href="/book">Book now</Link>
          </Button>
        }
      />

      {tiles.length > 0 && (
        <ul className="mb-10 grid auto-rows-[150px] grid-cols-2 gap-2 sm:auto-rows-[190px] md:mb-14 md:grid-cols-4 md:gap-3 lg:auto-rows-[220px]">
          {tiles.map((t, i) => (
            <li key={t.id} className={tileSpan(i, tiles.length)}>
              <button
                type="button"
                onClick={() => openCategory(t.id)}
                className="group relative block h-full w-full overflow-hidden rounded-[20px] bg-accent-soft text-left outline-none focus-visible:ring-3 focus-visible:ring-brand/40"
              >
                <Image
                  src={t.imagePath}
                  alt=""
                  fill
                  sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"}
                  className="object-cover transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-[1.03]"
                />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                  <span
                    className={cn(
                      "block leading-tight font-medium tracking-[-0.02em] text-white",
                      i === 0 ? "text-[clamp(1.5rem,3vw,2.25rem)]" : "text-[18px] md:text-[22px]",
                    )}
                  >
                    {t.name}
                  </span>
                  <span className="mt-1 block text-[13px] text-white/85">
                    {t.count} service{t.count === 1 ? "" : "s"} · from {formatINR(t.fromPaise)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div ref={menu} className="scroll-mt-24">
        <Tabs
          label="Service categories"
          size="public"
          items={catalog.categories.map((c) => ({
            value: c.id,
            label: c.name,
          }))}
          value={category}
          onValueChange={setCategory}
        />
        <ul className="mt-6 grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3" role="tabpanel">
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </ul>
      </div>
    </PageSection>
  );
}

function ServiceCard({ service: s }: { service: CatalogService }) {
  return (
    <li>
      <Link
        href={`/book?service=${s.slug}`}
        className="group block rounded-[20px] outline-none focus-visible:ring-3 focus-visible:ring-brand/40"
        aria-label={`Book ${s.name}, ${formatINR(s.pricePaise)}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-accent-soft">
          {s.imagePath ? (
            <Image
              src={s.imagePath}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-[1.03]"
            />
          ) : (
            <span
              aria-hidden
              className="absolute inset-0 grid place-items-center text-[44px] font-medium tracking-[-0.04em] text-accent-hover/40"
            >
              {s.name.charAt(0)}
            </span>
          )}
          <span className="absolute top-3 right-3 rounded-full bg-surface/90 px-3 py-1 text-[14px] font-semibold text-ink tabular-nums backdrop-blur-md">
            {s.priceIsFrom && <span className="font-normal text-muted">from </span>}
            {formatINR(s.pricePaise)}
          </span>
        </div>
        <div className="mt-3 flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <h3 className="text-[18px] font-medium tracking-[-0.01em]">{s.name}</h3>
            {s.description && <p className="mt-0.5 line-clamp-2 text-[14px] text-muted">{s.description}</p>}
            <p className="mt-1.5 flex items-center gap-1.5 text-[14px] text-muted">
              <Clock aria-hidden className="size-3.5" /> {formatDuration(s.durationMin)}
            </p>
          </div>
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-line text-ink transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-white">
            <ArrowRight aria-hidden className="size-4" />
          </span>
        </div>
      </Link>
    </li>
  );
}
