import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
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
    <html lang="en-IN" className={`${geist.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="surface-public min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
