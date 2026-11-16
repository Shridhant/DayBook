import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ManageBooking } from "@/components/booking/manage-booking";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/page-section";
import { Skeleton } from "@/components/ui/skeleton";
import { telLink, whatsappLink } from "@/lib/site";
import { getCatalog } from "@/server/catalog";
import { getManagedBooking } from "@/server/manage-booking";
import { MANAGE_KEY_PATTERN } from "@/server/manage-link";

// Private to whoever has the link: never indexed, and the key never goes in a link preview.
export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false } };

/** /booking/DB-XXXXXX?k=… — the customer's "manage my booking" page (phase 2). Always fresh. */
export default function ManageBookingPage({ params, searchParams }: PageProps<"/booking/[code]">) {
  return (
    <main className="bg-surface py-10 md:py-16">
      <Container>
        <Suspense fallback={<PageSkeleton />}>
          <ManageLoader params={params} searchParams={searchParams} />
        </Suspense>
      </Container>
    </main>
  );
}

async function ManageLoader({ params, searchParams }: Pick<PageProps<"/booking/[code]">, "params" | "searchParams">) {
  // What the customer may do depends on the current time, so this always renders per request.
  await connection();
  const [{ code }, { k }] = await Promise.all([params, searchParams]);
  const key = typeof k === "string" && MANAGE_KEY_PATTERN.test(k) ? k : null;
  const booking = key && /^DB-[0-9A-Z]{4,8}$/.test(code) ? await getManagedBooking(code, key) : null;
  if (!booking || !key) return <LinkProblem />;
  const catalog = await getCatalog();
  return <ManageBooking booking={booking} manageKey={key} catalog={catalog} />;
}

function LinkProblem() {
  const whatsapp = whatsappLink("Hi! My booking link isn't working.");
  const tel = telLink();
  return (
    <div className="mx-auto max-w-xl text-center">
      <h1 className="text-[28px] font-semibold tracking-[-0.025em]">We couldn&apos;t open that booking</h1>
      <p className="mt-3 text-[16px] text-muted">
        The link may be incomplete. Open it again from your confirmation email, or contact us with your booking reference (it starts with
        &quot;DB-&quot;).
      </p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        {whatsapp && (
          <Button asChild variant="primary" size="pub-md">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              WhatsApp us
            </a>
          </Button>
        )}
        {tel && (
          <Button asChild size="pub-md">
            <a href={tel}>Call the studio</a>
          </Button>
        )}
        <Button asChild variant="ghost" size="pub-md">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-xl" aria-busy="true" aria-label="Loading your booking">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-9 w-3/4" />
      <Skeleton className="mt-6 h-56 rounded-2xl" />
    </div>
  );
}
