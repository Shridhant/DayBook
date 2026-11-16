import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown the moment an admin link is clicked (Next prefetches it), while the page's data loads.
 * The sidebar stays put; only the page area shows this. Matches PageHeader + PageBody spacing.
 */
export default function AdminPageLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="flex min-h-14 items-center justify-between gap-4 border-b border-line px-4 py-2.5 sm:px-6">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
      <div className="space-y-3 px-4 py-5 sm:px-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
