"use client";

import Link from "next/link";
import { useEffect } from "react";
import { log } from "@/lib/log";
import { Button } from "@/components/ui/button";
import { Accent, Container, DisplayTitle, Eyebrow, Lead } from "@/components/ui/page-section";
import { site, telLink, whatsappLink } from "@/lib/site";

/**
 * Public error boundary. Server errors arrive with a generic message and a `digest` that matches
 * the server log line, so we show that reference instead of any technical detail.
 */
export default function PublicError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  const whatsapp = whatsappLink(`Hi! The ${site.name} website showed an error${digest ? ` (ref ${digest})` : ""}. I'd like to book.`);
  const tel = telLink();

  useEffect(() => {
    log.error("site", "page error", error);
  }, [error]);

  return (
    <main className="bg-surface">
      <Container className="flex min-h-[70dvh] flex-col justify-center py-16">
        <Eyebrow>{site.name}</Eyebrow>
        <DisplayTitle className="mt-3 max-w-[16ch]">
          Something <Accent>chipped</Accent>. We&apos;re on it.
        </DisplayTitle>
        <Lead className="mt-5">
          This page didn&apos;t load properly. Trying again usually fixes it. If you were booking, no payment was taken unless you saw a
          confirmation.
        </Lead>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button variant="primary" size="pub-lg" onClick={() => retry()}>
            Try again
          </Button>
          <Button asChild size="pub-lg">
            <Link href="/">Back to home</Link>
          </Button>
          {whatsapp ? (
            <Button asChild variant="ghost" size="pub-lg">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                Book on WhatsApp
              </a>
            </Button>
          ) : (
            tel && (
              <Button asChild variant="ghost" size="pub-lg">
                <a href={tel}>Call the studio</a>
              </Button>
            )
          )}
        </div>
        {digest && <p className="mt-8 text-[13px] text-muted">Reference: {digest}</p>}
      </Container>
    </main>
  );
}
