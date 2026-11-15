import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminThemeSync, THEME_SCRIPT } from "@/components/admin/theme";
import { StaffShell } from "@/components/staff/staff-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { site } from "@/lib/site";
import { requireStaffPageUser } from "@/server/admin/auth";

export const metadata: Metadata = {
  title: { default: "My schedule", template: `%s · ${site.name} staff` },
  robots: { index: false, follow: false },
};

/**
 * Technician portal (phase 2). Same dense app style and theme as the admin. The session check
 * runs inside <Suspense> (Cache Components), like the admin panel gate.
 */
export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return (
    <div className="surface-app min-h-dvh bg-surface text-ink">
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <AdminThemeSync />
      <Suspense fallback={<PortalSkeleton />}>
        <StaffGate>{children}</StaffGate>
      </Suspense>
    </div>
  );
}

async function StaffGate({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPageUser();
  return (
    <StaffShell name={user.name} brand={site.name}>
      {children}
    </StaffShell>
  );
}

function PortalSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-32" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
