"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SURFACE_SPRING } from "@/lib/motion";
import { useMotionSafe } from "@/lib/use-motion-safe";

/**
 * Phones only (DESIGN.md §11.3): a bottom "Book" bar once the hero has scrolled away,
 * hidden again when the footer is visible.
 */
export function StickyCta({ heroId = "hero", footerId = "site-footer" }: { heroId?: string; footerId?: string }) {
  const [heroVisible, setHeroVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(false);
  const m = useMotionSafe({ initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }, SURFACE_SPRING);

  useEffect(() => {
    const hero = document.getElementById(heroId);
    const footer = document.getElementById(footerId);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === hero) setHeroVisible(entry.isIntersecting);
        if (entry.target === footer) setFooterVisible(entry.isIntersecting);
      }
    });
    if (hero) observer.observe(hero);
    if (footer) observer.observe(footer);
    return () => observer.disconnect();
  }, [heroId, footerId]);

  const show = !heroVisible && !footerVisible;

  return (
    <AnimatePresence>
      {show && (
        <motion.div className="glass fixed inset-x-0 bottom-0 z-30 border-x-0 border-b-0 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden" {...m}>
          <div className="container-page pt-3">
            <Button asChild variant="primary" size="pub-lg" block>
              <Link href="/book">Book an appointment</Link>
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
