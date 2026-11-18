"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Signs out and returns to the login page; shared by the button and the admin account menu. */
export function useSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return { signOut, busy };
}

export function SignOutButton({ variant = "ghost", iconOnly = false }: { variant?: ButtonProps["variant"]; iconOnly?: boolean }) {
  const { signOut, busy } = useSignOut();
  return (
    <Button variant={variant} size={iconOnly ? "icon" : "sm"} onClick={signOut} loading={busy} aria-label="Sign out">
      {!busy && <LogOut />}
      {!iconOnly && "Sign out"}
    </Button>
  );
}
