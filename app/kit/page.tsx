import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KitShowcase } from "./kit-showcase";

export const metadata: Metadata = { title: "Component kit", robots: { index: false } };

/** Development-only preview of every UI component. Returns 404 in production. */
export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <KitShowcase />;
}
