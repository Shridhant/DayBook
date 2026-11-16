import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { THEME_SCRIPT } from "@/lib/admin-theme";
import { env } from "@/lib/env";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL(env.SITE_URL),
  title: { default: "Daybook — Nail Studio, Delhi NCR", template: "%s · Daybook" },
  description: "Nail art, extensions and care in Delhi NCR. See our work and book online.",
};

export const viewport: Viewport = {
  themeColor: "#fdfdfc",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. translators) add attributes to <html> before
    // React loads. It only silences attribute mismatches on this one element, not its children.
    <html
      lang="en-IN"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geist.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        {/* Admin/staff dark mode before first paint. Here (rendered once, on the server) rather than
            in the admin/staff layouts, which React re-renders on the client where scripts never run. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="surface-public min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
