import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

/** Public site chrome (header + footer). /book has its own focused header. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    // Grey page: each landing section is a white panel on it (components/ui/page-section.tsx).
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
