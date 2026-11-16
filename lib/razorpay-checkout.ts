"use client";

import { site } from "./site";

/**
 * Browser side of Razorpay Checkout. The script is loaded only when the customer reaches the
 * payment step (DESIGN.md §11.7: no third-party scripts until needed).
 */

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayFailure = { error: { description?: string; reason?: string } };

type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: "INR";
  name: string;
  description?: string;
  prefill?: { name?: string; contact?: string; email?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void; confirm_close?: boolean };
};

type RazorpayInstance = { open: () => void; on: (event: "payment.failed", cb: (r: RazorpayFailure) => void) => void };

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

export function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type CheckoutResult =
  | { kind: "paid"; orderId: string; paymentId: string; signature: string }
  | { kind: "dismissed"; lastError: string | null };

/**
 * Opens Checkout and resolves when it finishes. Failed attempts don't resolve: Razorpay keeps the
 * window open so the customer can retry; if they close it, `lastError` explains the last failure.
 */
export async function openCheckout(params: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  name: string;
  description: string;
  prefill: { name: string; contact: string | null; email: string | null };
}): Promise<CheckoutResult> {
  await loadCheckout();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Couldn't load the payment window. Please try again.");

  return new Promise<CheckoutResult>((resolve) => {
    let lastError: string | null = null;
    const instance = new Razorpay({
      key: params.keyId,
      order_id: params.orderId,
      amount: params.amountPaise,
      currency: "INR",
      name: params.name,
      description: params.description,
      prefill: {
        name: params.prefill.name,
        contact: params.prefill.contact ?? undefined,
        email: params.prefill.email ?? undefined,
      },
      theme: { color: site.colors.accent },
      handler: (r) =>
        resolve({ kind: "paid", orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
      modal: { ondismiss: () => resolve({ kind: "dismissed", lastError }) },
    });
    instance.on("payment.failed", (r) => {
      lastError = r.error.description ?? "The payment didn't go through.";
    });
    instance.open();
  });
}
