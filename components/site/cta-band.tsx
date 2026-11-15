import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Accent, PageSection } from "@/components/ui/page-section";

/** DESIGN.md §11.3 (9): the page's one dark moment. */
export function CtaBand() {
  return (
    <PageSection tone="ink">
      <div className="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
        <h2 className="max-w-[18ch] text-[clamp(1.75rem,4.5vw,2.75rem)] leading-[1.1] font-semibold tracking-[-0.025em] text-balance">
          Your next set is <Accent>one tap</Accent> away.
        </h2>
        <Button asChild variant="inverse" size="pub-lg">
          <Link href="/book">Book an appointment</Link>
        </Button>
      </div>
    </PageSection>
  );
}
