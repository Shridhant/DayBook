import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";

/** Admin 404 (deleted artist, mistyped admin URL): stays in the admin's dense style. */
export default function AdminNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <EmptyState
        icon={SearchX}
        title="Not found"
        className="w-full max-w-md bg-surface"
        action={
          <div className="flex justify-center gap-1.5">
            <Button asChild variant="primary" size="md">
              <Link href="/admin/today">Go to calendar</Link>
            </Button>
            <Button asChild size="md">
              <Link href="/admin/bookings">Bookings</Link>
            </Button>
          </div>
        }
      >
        This page doesn&apos;t exist, or the item was deleted.
      </EmptyState>
    </main>
  );
}
