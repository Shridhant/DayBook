import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { paymentSchema, verifyWebhookSignature } from "@/lib/razorpay";
import { recordPayment, settlePayment, type PaymentOutcome } from "./payments";

/**
 * Razorpay webhooks: the source of truth for payment state (AGENTS.md §7).
 * Every delivery is stored in payment_events keyed by Razorpay's event id, so retries and
 * duplicates are processed exactly once.
 */

const eventSchema = z.object({
  event: z.string(),
  payload: z
    .object({
      payment: z.object({ entity: paymentSchema }).optional(),
    })
    .loose(),
});

export type WebhookResult =
  | { status: "processed"; event: string; outcome: PaymentOutcome | "ignored" }
  | { status: "duplicate" }
  | { status: "invalid_signature" }
  | { status: "not_configured" }
  | { status: "invalid_payload" };

const HANDLED = new Set(["payment.authorized", "payment.captured", "payment.failed", "order.paid"]);

export async function handleRazorpayWebhook(rawBody: string, signature: string | null, eventIdHeader: string | null): Promise<WebhookResult> {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return { status: "not_configured" };
  if (!signature || !verifyWebhookSignature(rawBody, signature, secret)) return { status: "invalid_signature" };

  let parsed: z.infer<typeof eventSchema>;
  try {
    parsed = eventSchema.parse(JSON.parse(rawBody));
  } catch {
    return { status: "invalid_payload" };
  }

  const eventId = eventIdHeader || `sha256:${createHash("sha256").update(rawBody).digest("hex")}`;

  // Store first. If it was already processed, stop; if a previous attempt crashed midway, retry it.
  const [stored] = await sql<{ processed_at: Date | null }[]>`
    insert into payment_events (rzp_event_id, event_type, payload)
    values (${eventId}, ${parsed.event}, ${sql.json(JSON.parse(rawBody))})
    on conflict (rzp_event_id) do update set event_type = excluded.event_type
    returning processed_at`;
  if (stored.processed_at) return { status: "duplicate" };

  let outcome: PaymentOutcome | "ignored" = "ignored";
  const payment = parsed.payload.payment?.entity;
  if (HANDLED.has(parsed.event) && payment) {
    // payment.authorized needs a capture call; the others carry the final state in the signed payload.
    outcome =
      parsed.event === "payment.authorized" ? (await settlePayment(payment.id)).outcome : (await recordPayment(payment)).outcome;
  }

  await sql`update payment_events set processed_at = now() where rzp_event_id = ${eventId}`;
  return { status: "processed", event: parsed.event, outcome };
}
