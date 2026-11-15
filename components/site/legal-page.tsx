import type { ReactNode } from "react";
import { Container, Eyebrow } from "@/components/ui/page-section";
import { site, telLink, whatsappLink } from "@/lib/site";

/** Shared layout for the policy pages: readable long-form text at 16px (DESIGN.md §11.1). */
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="bg-surface py-12 md:py-20">
      <Container className="max-w-3xl">
        <Eyebrow>{site.name}</Eyebrow>
        <h1 className="mt-3 text-[clamp(2rem,5vw,2.75rem)] leading-[1.1] font-semibold tracking-[-0.025em]">{title}</h1>
        <p className="mt-3 text-[14px] text-muted">Last updated {updated}</p>
        {intro && <div className="mt-6 text-[17px] leading-relaxed text-muted">{intro}</div>}
        <div
          className={[
            "mt-10 space-y-4 text-[16px] leading-[1.7]",
            "[&_h2]:mt-10 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:first:mt-0",
            "[&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5",
            "[&_a]:text-accent-hover [&_a]:underline [&_a]:decoration-brand/40 [&_a]:underline-offset-4",
          ].join(" ")}
        >
          {children}
        </div>
      </Container>
    </main>
  );
}

export const businessName = () => site.legalName || site.name;

/** Contact lines from lib/site.ts; anything not filled in is simply omitted. */
export function ContactLines() {
  const tel = telLink();
  const whatsapp = whatsappLink("Hi! I have a question about my booking.");
  const lines = [
    site.address && <li key="a">Address: {site.address}</li>,
    tel && (
      <li key="p">
        Phone: <a href={tel}>{site.phone}</a>
      </li>
    ),
    whatsapp && (
      <li key="w">
        WhatsApp: <a href={whatsapp}>message us</a>
      </li>
    ),
    site.email && (
      <li key="e">
        Email: <a href={`mailto:${site.email}`}>{site.email}</a>
      </li>
    ),
  ].filter(Boolean);
  return lines.length ? <ul>{lines}</ul> : <p>Contact details will be added here shortly.</p>;
}
