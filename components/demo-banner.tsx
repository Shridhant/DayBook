import { DEMO_MODE } from "@/lib/demo";

/**
 * Slim strip on every page in demo mode, so nobody mistakes the demo for a live salon. The root
 * layout renders it above everything; the admin shell hides that copy (globals.css) and renders
 * its own at the top of the content column, so the sticky, full-height sidebar isn't pushed down.
 */
export function DemoBanner() {
  if (!DEMO_MODE) return null;
  return (
    <div role="note" data-demo-banner className="bg-ink px-4 py-1.5 text-center text-[12px] leading-snug text-surface">
      Demo site with sample data. Payments are in test mode: no real money is charged.
    </div>
  );
}
