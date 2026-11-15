"use client";

import { Clock, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";
import { formatDate, formatDuration, formatInstantTime, toIst } from "@/lib/time";
import type { HoldDto } from "./api";
import { StepHeading } from "./step-heading";

export type PayError = { message: string; tone: "danger" | "warning"; action?: "pick_time" };

function useSecondsLeft(until: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
}

export function PayStep({
  hold,
  cancelWindowHours,
  busy,
  error,
  onPay,
  onPickTime,
}: {
  hold: HoldDto;
  cancelWindowHours: number;
  busy: boolean;
  error: PayError | null;
  onPay: () => void;
  onPickTime: () => void;
}) {
  const secondsLeft = useSecondsLeft(hold.holdExpiresAt);
  const expired = secondsLeft === 0;
  const start = new Date(hold.startsAt);
  const remaining = hold.totalPaise - hold.amountDueNowPaise;
  const duration = hold.items.reduce((sum, i) => sum + i.durationMin, 0);
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <section aria-labelledby="step-pay">
      <StepHeading id="step-pay" title="Review & pay" hint={hold.amountDueNowPaise > 0 ? "Pay a small amount now to confirm. The rest is paid at the studio." : "Check the details and confirm. You pay at the studio."} />

      <div className="mt-6 max-w-xl space-y-4">
        <div className={expired ? "hidden" : "flex items-center gap-2 text-[14px] text-muted"} aria-live="polite">
          <Clock aria-hidden className="size-4" />
          We&apos;re holding this slot for you for <span className="font-medium text-ink tabular-nums">{mm}:{ss}</span>
        </div>

        <div className="card p-5">
          <p className="text-[18px] font-semibold tracking-[-0.01em]">
            {formatDate(toIst(start).date)}, {formatInstantTime(start)}
          </p>
          <p className="mt-0.5 text-[15px] text-muted">
            with {hold.staff.name} · {formatDuration(duration)}
          </p>
          <ul className="mt-4 space-y-2 border-t border-line pt-4 text-[15px]">
            {hold.items.map((item) => (
              <li key={item.serviceId} className="flex justify-between gap-4">
                <span>{item.name}</span>
                <span className="tabular-nums">{formatINR(item.pricePaise)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Total</dt>
              <dd className="tabular-nums">{formatINR(hold.totalPaise)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Pay at the studio</dt>
              <dd className="tabular-nums">{formatINR(remaining)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 pt-1">
              <dt className="font-medium">Pay now</dt>
              <dd className="text-[24px] font-semibold tracking-tight tabular-nums">{formatINR(hold.amountDueNowPaise)}</dd>
            </div>
          </dl>
        </div>

        <p className="text-[14px] text-muted">
          {hold.amountDueNowPaise > 0
            ? `Free cancellation up to ${cancelWindowHours} hours before your appointment. After that, the amount paid now isn't refundable.`
            : `Please let us know at least ${cancelWindowHours} hours before if you can't make it.`}
        </p>

        {expired ? (
          <Alert
            tone="warning"
            title="Your hold has expired"
            action={
              <Button size="pub-md" onClick={onPickTime}>
                Pick a time again
              </Button>
            }
          >
            Slots are held for a few minutes so others can book too.
          </Alert>
        ) : (
          error && (
            <Alert
              tone={error.tone}
              action={
                error.action === "pick_time" ? (
                  <Button size="pub-md" onClick={onPickTime}>
                    Pick another time
                  </Button>
                ) : undefined
              }
            >
              {error.message}
            </Alert>
          )
        )}

        {!expired && (
          <>
            <Button variant="primary" size="pub-lg" block loading={busy} onClick={onPay}>
              {hold.amountDueNowPaise > 0 ? `Pay ${formatINR(hold.amountDueNowPaise)}` : "Confirm booking"}
            </Button>
            <p className="text-center text-[13px] text-muted">
              By {hold.amountDueNowPaise > 0 ? "paying" : "confirming"}, you agree to our{" "}
              <a href="/terms" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-ink">
                terms
              </a>{" "}
              and{" "}
              <a href="/cancellation-policy" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-ink">
                cancellation policy
              </a>
              .
            </p>
            {hold.amountDueNowPaise > 0 && (
              <p className="flex items-center justify-center gap-1.5 text-[13px] text-muted">
                <ShieldCheck aria-hidden className="size-4" /> Secure payment by Razorpay · UPI, cards, netbanking
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
