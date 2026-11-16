import type { Metadata } from "next";
import { AdminThemeSync } from "@/components/admin/theme";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Daybook admin" },
  robots: { index: false, follow: false },
};

/** Admin surface: 13px dense UI (DESIGN.md §1–9) with optional dark mode. */
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="surface-app min-h-dvh bg-surface text-ink">
      <AdminThemeSync />
      {children}
    </div>
  );
}
