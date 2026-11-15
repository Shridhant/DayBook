import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { site } from "@/lib/site";
import { requirePageUser } from "@/server/admin/auth";

/**
 * Signed-in admin area. The session read happens inside <Suspense> (Next 16 Cache Components):
 * the skeleton shows instantly, then the gate verifies the user and streams the real page.
 */
export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return (
    <AdminShell user={{ name: user.name, email: user.email, role: user.role }} brand={site.name}>
      {children}
    </AdminShell>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[220px_minmax(0,1fr)]" aria-busy="true" aria-label="Loading">
      <div className="hidden border-r border-line bg-canvas p-3 lg:block">
        <Skeleton className="h-7 w-28" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      </div>
      <div className="p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-6 h-64 rounded-xl" />
      </div>
    </div>
  );
}
