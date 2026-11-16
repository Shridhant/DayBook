import { DEMO_MODE } from "@/lib/demo";

/** Slim strip on every page in demo mode, so nobody mistakes the demo for a live salon. */
export function DemoBanner() {
  if (!DEMO_MODE) return null;
  return (
    <div role="note" className="bg-ink px-4 py-1.5 text-center text-[12px] leading-snug text-surface">
      Demo site with sample data. Payments are in test mode: no real money is charged.
    </div>
  );
}
