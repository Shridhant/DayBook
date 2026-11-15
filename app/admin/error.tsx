"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { log } from "@/lib/log";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";

/** Admin error boundary: retry, a way out, and the reference that matches the server log. */
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";

  useEffect(() => {
    log.error("admin", "page error", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        className="w-full max-w-md bg-surface"
        action={
          <div className="flex flex-col items-center gap-3">
            <div className="flex justify-center gap-1.5">
              <Button variant="primary" size="md" onClick={() => retry()}>
                Try again
              </Button>
              <Button asChild size="md">
                <Link href="/admin/today">Go to calendar</Link>
              </Button>
            </div>
            {digest && (
              <p className="text-xs">
                Reference <Code>{digest}</Code>
              </p>
            )}
          </div>
        }
      >
        Nothing was changed. Try again; if it keeps happening, share the reference below with whoever maintains the site.
      </EmptyState>
    </main>
  );
}
