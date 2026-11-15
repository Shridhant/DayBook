"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageSection, SectionHeader } from "@/components/ui/page-section";
import { Tabs } from "@/components/ui/tabs";
import { formatINR } from "@/lib/money";
import { formatDuration } from "@/lib/time";
import type { Catalog } from "@/server/catalog";

/** DESIGN.md §11.3 (3): category tabs and border-b rows, each with a Book action. */
export function ServicesSection({ catalog }: { catalog: Pick<Catalog, "categories" | "services"> }) {
  const [category, setCategory] = useState(catalog.categories[0]?.id ?? "");
  const services = catalog.services.filter((s) => s.categoryId === category);

  if (catalog.categories.length === 0) return null;

  return (
    <PageSection id="services" tone="canvas" className="scroll-mt-16">
      <SectionHeader
        eyebrow="Services"
        title="Menu & prices"
        lead="Clear prices, no surprises. Pay a small amount online to book; the rest at the studio."
      />
      <Tabs
        label="Service categories"
        size="public"
        items={catalog.categories.map((c) => ({ value: c.id, label: c.name }))}
        value={category}
        onValueChange={setCategory}
      />
      <ul className="mt-6 grid gap-x-12 lg:grid-cols-2" role="tabpanel">
        {services.map((s) => (
          <li key={s.id} className="flex items-center gap-4 border-b border-line py-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-[18px] font-semibold tracking-[-0.01em] md:text-[20px]">{s.name}</h3>
              {s.description && <p className="mt-0.5 text-[14px] text-muted">{s.description}</p>}
              <p className="mt-1 text-[14px] text-muted">{formatDuration(s.durationMin)}</p>
            </div>
            <span className="shrink-0 text-right font-semibold tabular-nums">
              {s.priceIsFrom && <span className="block text-[12px] font-normal text-muted">from</span>}
              {formatINR(s.pricePaise)}
            </span>
            <Button asChild variant="ghost" size="pub-sm" className="shrink-0">
              <Link href={`/book?service=${s.slug}`} aria-label={`Book ${s.name}`}>
                Book
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </PageSection>
  );
}
