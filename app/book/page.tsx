import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BookingFlow } from "@/components/booking/booking-flow";
import { Skeleton } from "@/components/ui/skeleton";
import { site } from "@/lib/site";
import { getCatalog } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Book an appointment",
  description: `Book nail art, extensions, manicures and pedicures at ${site.name}. Pick your artist and time, and pay a small amount online to confirm.`,
};

export default async function BookPage() {
  const catalog = await getCatalog();

  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="container-page flex h-14 items-center justify-between md:h-16">
          <Link
            href="/"
            className="-ml-2 inline-flex h-11 items-center gap-2 rounded-full px-2 text-[15px] font-medium text-ink/80 outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-brand/30"
          >
            <ArrowLeft aria-hidden className="size-5" />
            <span className="font-semibold text-ink">{site.name}</span>
          </Link>
          <span className="text-[14px] text-muted">Book an appointment</span>
        </div>
      </header>

      <main>
        {/* BookingFlow reads ?service= / ?staff= via useSearchParams, which needs a Suspense boundary. */}
        <Suspense fallback={<BookingSkeleton />}>
          <BookingFlow catalog={catalog} />
        </Suspense>
      </main>
    </div>
  );
}

function BookingSkeleton() {
  return (
    <div className="container-page pt-6" aria-busy="true" aria-label="Loading booking">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-8 h-7 w-64" />
      <div className="mt-6 space-y-2 lg:w-7/12">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
