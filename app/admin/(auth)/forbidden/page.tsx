import type { Metadata } from "next";
import { SignOutButton } from "@/components/admin/sign-out-button";

export const metadata: Metadata = { title: "No access" };

/** Signed in, but this login can't use the admin (or is a technician login not linked to an artist profile). */
export default function ForbiddenPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="card w-full max-w-sm rounded-2xl p-6 text-center">
        <h1 className="text-[15px] font-semibold">You don&apos;t have access here</h1>
        <p className="mt-1.5 text-muted">
          This login isn&apos;t set up for this area. Artists need their login linked to their artist profile; ask the owner to check it
          under Team.
        </p>
        <div className="mt-5 flex justify-center">
          <SignOutButton variant="secondary" />
        </div>
      </div>
    </main>
  );
}
