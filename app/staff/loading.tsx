import { Skeleton } from "@/components/ui/skeleton";

/** Shown instantly when switching tabs in the staff portal, while the page's data loads. */
export default function StaffPageLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="mt-2 h-3 w-24" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
