import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "./env";

/**
 * Minimal Razorpay client (AGENTS.md §7 "Payments"). Plain fetch against the REST API: we need
 * five calls, which doesn't justify the SDK dependency.
 * Docs: https://razorpay.com/docs/api/orders/, /payments/ and /refunds/
 */

const API = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 10_000;

export class RazorpayNotConfiguredError extends Error {
  constructor() {
    super("Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
  }
}

export class RazorpayApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly description: string,
  ) {
    super(`Razorpay API ${status}: ${description}`);
  }
}

export function isRazorpayConfigured(): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

function credentials() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw new RazorpayNotConfiguredError();
  return { keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET };
}

/** The public key id, safe to send to the browser for Checkout. */
export function publicKeyId(): string {
  return credentials().keyId;
}

async function call<T>(method: "GET" | "POST", path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
  const { keyId, keySecret } = credentials();
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const description =
      (json as { error?: { description?: string } } | null)?.error?.description ?? response.statusText;
    throw new RazorpayApiError(response.status, description);
  }
  return schema.parse(json);
}

/* ---------- API objects (only the fields we use) ---------- */

export const orderSchema = z.object({
  id: z.string().startsWith("order_"),
  amount: z.number().int(),
  currency: z.string(),
  status: z.enum(["created", "attempted", "paid"]),
  receipt: z.string().nullish(),
});
export type RazorpayOrder = z.infer<typeof orderSchema>;

export const paymentSchema = z.object({
  id: z.string().startsWith("pay_"),
  order_id: z.string().nullish(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.enum(["created", "authorized", "captured", "refunded", "failed"]),
  method: z.string().nullish(),
  amount_refunded: z.number().int().optional(),
});
export type RazorpayPayment = z.infer<typeof paymentSchema>;

export const refundSchema = z.object({
  id: z.string().startsWith("rfnd_"),
  payment_id: z.string().startsWith("pay_"),
  amount: z.number().int(),
  currency: z.string(),
  status: z.enum(["pending", "processed", "failed"]),
  // Razorpay returns [] when there are no notes.
  notes: z.union([z.record(z.string(), z.string()), z.array(z.unknown())]).nullish(),
});
export type RazorpayRefund = z.infer<typeof refundSchema>;

/** Our refund id, stored in the refund's notes so webhooks can match a refund we started. */
export function refundNoteId(refund: RazorpayRefund): string | null {
  const notes = refund.notes;
  return notes && !Array.isArray(notes) && typeof notes.refund_id === "string" ? notes.refund_id : null;
}

/* ---------- Calls ---------- */

export function createOrder(params: { amountPaise: number; receipt: string; notes?: Record<string, string> }) {
  return call("POST", "/orders", orderSchema, {
    amount: params.amountPaise,
    currency: "INR",
    receipt: params.receipt.slice(0, 40),
    notes: params.notes,
  });
}

export function fetchPayment(paymentId: string) {
  return call("GET", `/payments/${encodeURIComponent(paymentId)}`, paymentSchema);
}

/** Captures an authorized payment. Usually unnecessary when the account auto-captures. */
export function capturePayment(paymentId: string, amountPaise: number) {
  return call("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, paymentSchema, {
    amount: amountPaise,
    currency: "INR",
  });
}

/**
 * Refunds part or all of a captured payment, at normal speed (5–7 working days, no extra fee).
 * `refundId` is ours: it goes in the receipt and notes so the webhook can match the refund even
 * if this call times out after Razorpay accepted it.
 */
export function createRefund(params: { paymentId: string; amountPaise: number; refundId: string; notes?: Record<string, string> }) {
  return call("POST", `/payments/${encodeURIComponent(params.paymentId)}/refund`, refundSchema, {
    amount: params.amountPaise,
    speed: "normal",
    receipt: params.refundId.slice(0, 40),
    notes: { ...params.notes, refund_id: params.refundId },
  });
}

/* ---------- Signatures ---------- */

function hmacHex(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Constant-time comparison of two hex signatures. */
function safeEqualHex(expected: string, actual: string): boolean {
  if (!/^[0-9a-f]+$/i.test(actual) || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}

/**
 * Checkout success handler signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret).
 * Proves the browser didn't invent the payment id, but the payment state is still fetched from
 * the API (or taken from the webhook) before confirming anything.
 */
export function verifyCheckoutSignature(
  params: { orderId: string; paymentId: string; signature: string },
  keySecret: string = credentials().keySecret,
): boolean {
  return safeEqualHex(hmacHex(keySecret, `${params.orderId}|${params.paymentId}`), params.signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook secret). Must use the raw body. */
export function verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
  return safeEqualHex(hmacHex(webhookSecret, rawBody), signature);
}
