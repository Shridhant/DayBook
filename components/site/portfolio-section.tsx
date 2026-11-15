"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { Dialog as RDialog } from "radix-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/choice";
import { PageSection, SectionHeader } from "@/components/ui/page-section";
import { modalIn, SURFACE_SPRING } from "@/lib/motion";
import { useMotionSafe } from "@/lib/use-motion-safe";
import type { Catalog } from "@/server/catalog";
import type { PortfolioItem } from "@/server/content";

const ALL = "all";

/** DESIGN.md §11.3 (4): filter chips, 4:5 grid, lightbox with "Book this look". */
export function PortfolioSection({ items, categories }: { items: PortfolioItem[]; categories: Catalog["categories"] }) {
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState(ALL);
  const [open, setOpen] = useState<number | null>(null);

  const usedCategories = useMemo(
    () => categories.filter((c) => items.some((i) => i.categoryId === c.id)),
    [categories, items],
  );
  const visible = filter === ALL ? items : items.filter((i) => i.categoryId === filter);

  if (items.length === 0) return null;

  return (
    <PageSection id="work" className="scroll-mt-16">
      <SectionHeader eyebrow="Portfolio" title="Recent work" lead="A few of our favourite sets. Tap any look to see it bigger." />

      {usedCategories.length > 1 && (
        <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by category">
          <FilterChip selected={filter === ALL} onClick={() => setFilter(ALL)}>
            All
          </FilterChip>
          {usedCategories.map((c) => (
            <FilterChip key={c.id} selected={filter === c.id} onClick={() => setFilter(c.id)}>
              {c.name}
            </FilterChip>
          ))}
        </div>
      )}

      <motion.ul layout={!reduce} className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
        <AnimatePresence initial={false}>
          {visible.map((item, index) => (
            <motion.li
              key={item.id}
              layout={reduce ? false : "position"}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.14 } }}
            >
              <button
                type="button"
                onClick={() => setOpen(index)}
                className="group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl bg-canvas outline-none focus-visible:ring-3 focus-visible:ring-brand/40"
                aria-label={`View ${item.caption ?? item.alt}`}
              >
                <Image
                  src={item.imagePath}
                  alt={item.alt}
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                  className="object-cover transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-[1.03]"
                />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      <Lightbox items={visible} index={open} onIndex={setOpen} />
    </PageSection>
  );
}

function Lightbox({ items, index, onIndex }: { items: PortfolioItem[]; index: number | null; onIndex: (i: number | null) => void }) {
  const m = useMotionSafe(modalIn, SURFACE_SPRING);
  const item = index === null ? null : items[index];
  const count = items.length;

  const step = useCallback(
    (delta: number) => index !== null && onIndex((index + delta + count) % count),
    [index, count, onIndex],
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, step]);

  return (
    <RDialog.Root open={item !== null} onOpenChange={(o) => !o && onIndex(null)}>
      <AnimatePresence>
        {item && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-black/85" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </RDialog.Overlay>
            <RDialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 outline-none"
                // This layer covers the scrim, so a tap on empty space must close it here.
                onClick={(e) => e.target === e.currentTarget && onIndex(null)}
                {...m}
              >
                <RDialog.Title className="sr-only">{item.caption ?? "Portfolio image"}</RDialog.Title>
                <RDialog.Description className="sr-only">{item.alt}</RDialog.Description>
                <RDialog.Close asChild>
                  <Button variant="inverse" size="pub-icon" className="absolute top-4 right-4" aria-label="Close">
                    <X />
                  </Button>
                </RDialog.Close>

                <motion.div
                  key={item.id}
                  className="relative aspect-[4/5] w-full max-w-[min(90vw,calc((100dvh-180px)*0.8))] overflow-hidden rounded-2xl bg-canvas"
                  drag={count > 1 ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.4}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -60) step(1);
                    else if (info.offset.x > 60) step(-1);
                  }}
                >
                  <Image src={item.imagePath} alt={item.alt} fill sizes="90vw" className="pointer-events-none object-cover" />
                </motion.div>

                <div className="mt-4 flex w-full max-w-md items-center justify-between gap-3 text-surface">
                  {count > 1 ? (
                    <Button variant="inverse" size="pub-icon" onClick={() => step(-1)} aria-label="Previous image">
                      <ChevronLeft />
                    </Button>
                  ) : (
                    <span className="size-11" />
                  )}
                  <div className="min-w-0 text-center">
                    {item.caption && <p className="truncate text-[16px] font-medium">{item.caption}</p>}
                    <Button asChild variant="primary" size="pub-sm" className="mt-2">
                      <Link href="/book">Book this look</Link>
                    </Button>
                  </div>
                  {count > 1 ? (
                    <Button variant="inverse" size="pub-icon" onClick={() => step(1)} aria-label="Next image">
                      <ChevronRight />
                    </Button>
                  ) : (
                    <span className="size-11" />
                  )}
                </div>
              </motion.div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}
