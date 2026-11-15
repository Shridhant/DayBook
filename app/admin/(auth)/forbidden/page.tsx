import type { Metadata } from "next";
import { SignOutButton } from "@/components/admin/sign-out-button";

export const metadata: Metadata = { title: "No access" };

/** Signed in, but the role isn't allowed into the admin (e.g. technicians before the staff portal). */
export default function ForbiddenPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="card w-full max-w-sm rounded-2xl p-6 text-center">
        <h1 className="text-[15px] font-semibold">You don&apos;t have access to the admin</h1>
        <p className="mt-1.5 text-muted">This area is for the owner and front desk. Ask the owner if you think this is a mistake.</p>
        <div className="mt-5 flex justify-center">
          <SignOutButton variant="secondary" />
        </div>
      </div>
    </main>
  );
}
