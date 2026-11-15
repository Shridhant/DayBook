import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Accent, Container, DisplayTitle, Eyebrow, Lead } from "@/components/ui/page-section";

/** Placeholder until the landing page is built (Phase 1 → Public site). */
export default function Home() {
  return (
    <main className="flex min-h-dvh items-center">
      <Container>
        <Eyebrow>Nail studio · Delhi NCR</Eyebrow>
        <DisplayTitle className="mt-3">
          Nails, done <Accent>beautifully</Accent>.
        </DisplayTitle>
        <Lead className="mt-5">The new Daybook site is on its way. Online booking opens soon.</Lead>
        {process.env.NODE_ENV !== "production" && (
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="primary" size="pub-lg">
              <Link href="/kit">Open the component kit</Link>
            </Button>
          </div>
        )}
      </Container>
    </main>
  );
}
