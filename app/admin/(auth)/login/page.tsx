import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/login-form";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      {/* LoginForm reads ?next= via useSearchParams, which needs a Suspense boundary. */}
      <Suspense>
        <LoginForm brand={site.name} />
      </Suspense>
    </main>
  );
}
