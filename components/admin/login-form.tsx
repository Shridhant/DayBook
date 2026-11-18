"use client";

import { BrandMark } from "@/components/brand-mark";
import { motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useMotionSafe } from "@/lib/use-motion-safe";

/** Only allow redirects back into the admin or staff portal (no open redirects to other sites). */
function safeNext(value: string | null): string {
  return value && /^\/(admin|staff)(\/|\?|$)/.test(value) ? value : "/admin";
}

export function LoginForm({ brand }: { brand: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // DESIGN.md §6 auth card entrance.
  const m = useMotionSafe(
    { initial: { opacity: 0, y: 8, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 } },
    { type: "spring", duration: 0.5, bounce: 0.15 },
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, rememberMe: true }),
      });
      if (response.ok) {
        router.replace(safeNext(params.get("next")));
        router.refresh();
        return;
      }
      setError(
        response.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : response.status === 401
            ? "Incorrect email or password."
            : "Couldn't sign you in. If your account was deactivated, ask the owner.",
      );
    } catch {
      setError("You seem to be offline. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div className="card w-full max-w-sm rounded-2xl p-6 shadow-[0_1px_2px_rgb(0_0_0/.04)]" {...m}>
      <div className="flex items-center gap-2.5">
        <BrandMark size={32} />
        <div className="leading-tight">
          <p className="text-[15px] font-semibold">{brand}</p>
          <p className="text-[11px] text-muted">Admin</p>
        </div>
      </div>
      <h1 className="mt-6 text-[15px] font-semibold">Sign in</h1>
      <form className="mt-4 space-y-4" onSubmit={onSubmit} noValidate>
        <Field label="Email">
          <Input
            size="app-lg"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <Input
            size="app-lg"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && (
          <Alert size="app" tone="danger">
            {error}
          </Alert>
        )}
        <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={!email || !password}>
          Sign in
        </Button>
      </form>
    </motion.div>
  );
}
