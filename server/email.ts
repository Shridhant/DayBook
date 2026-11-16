import "server-only";
import { after } from "next/server";
import nodemailer, { type Transporter } from "nodemailer";
import { sql } from "@/lib/db";
import { isTestOnlyAddress } from "@/lib/email-address";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

/**
 * Sends queued emails from email_outbox over SMTP. Safe to run concurrently (rows are claimed with
 * FOR UPDATE SKIP LOCKED), retried with backoff, and stale mail expires instead of arriving late.
 */

export const MAX_ATTEMPTS = 5;
/** Don't send booking emails that are more than a day old (e.g. SMTP was down or not configured). */
const MAX_AGE_HOURS = 24;

export function isEmailConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.EMAIL_FROM);
}

let transporter: Transporter | null = null;
function transport(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // implicit TLS on 465; STARTTLS on 587
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

/** Minutes to wait before the next try: 1, 2, 4, 8… */
export function backoffMinutes(attempts: number): number {
  return 2 ** Math.max(0, attempts - 1);
}

type OutboxRow = { id: string; to_email: string; subject: string; html: string; text_body: string; ics: string | null; attempts: number };

export async function processEmailOutbox(options: { limit?: number; send?: (row: OutboxRow) => Promise<void> } = {}) {
  const limit = options.limit ?? 20;
  // Old mail is pointless now; rows stuck in "sending" (crash mid-send) go back to the queue.
  await sql`
    update email_outbox set status = 'expired', last_error = coalesce(last_error, 'Not sent within a day')
    where status in ('pending', 'sending') and created_at < now() - make_interval(hours => ${MAX_AGE_HOURS})`;
  await sql`update email_outbox set status = 'pending' where status = 'sending' and next_attempt_at < now() - interval '10 minutes'`;

  const send =
    options.send ??
    (async (row: OutboxRow) => {
      await transport().sendMail({
        from: env.EMAIL_FROM,
        to: row.to_email,
        subject: row.subject,
        html: row.html,
        text: row.text_body,
        attachments: row.ics ? [{ filename: "booking.ics", content: row.ics, contentType: "text/calendar; charset=utf-8; method=PUBLISH" }] : [],
      });
    });
  if (!options.send && !isEmailConfigured()) return { sent: 0, failed: 0, skipped: true };

  const rows = await sql<OutboxRow[]>`
    update email_outbox set status = 'sending', attempts = attempts + 1, next_attempt_at = now()
    where id in (
      select id from email_outbox
      where status = 'pending' and next_attempt_at <= now()
      order by created_at limit ${limit}
      for update skip locked)
    returning id, to_email, subject, html, text_body, ics, attempts`;

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    if (isTestOnlyAddress(row.to_email)) {
      // Queued before such addresses were skipped (demo data): drop it rather than bounce.
      await sql`update email_outbox set status = 'failed', last_error = 'Test-only address, not sent' where id = ${row.id}`;
      continue;
    }
    try {
      await send(row);
      await sql`update email_outbox set status = 'sent', sent_at = now(), last_error = null where id = ${row.id}`;
      sent++;
    } catch (error) {
      failed++;
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      const giveUp = row.attempts >= MAX_ATTEMPTS;
      await sql`
        update email_outbox set
          status = ${giveUp ? "failed" : "pending"},
          last_error = ${message},
          next_attempt_at = now() + make_interval(mins => ${backoffMinutes(row.attempts)})
        where id = ${row.id}`;
      log.error("email", `send failed (attempt ${row.attempts}${giveUp ? ", giving up" : ""})`, error);
    }
  }
  return { sent, failed, skipped: false };
}

/** Call from a route handler after a change that may have queued emails. Runs after the response. */
export function sendQueuedEmailsSoon() {
  after(async () => {
    try {
      await processEmailOutbox();
    } catch (error) {
      log.error("email", "outbox run failed", error);
    }
  });
}
