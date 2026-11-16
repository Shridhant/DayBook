import "server-only";
import { formatINR } from "@/lib/money";
import { formatIndianMobile } from "@/lib/phone";
import { formatDate, formatInstantTime, toIst } from "@/lib/time";

/**
 * Email content for booking events. Pure functions (unit-tested): every value that came from a
 * customer is HTML-escaped. Kept simple and table-free so it renders in every mail app.
 */

export type BookingSummary = {
  id: string;
  code: string;
  source: "online" | "walk_in" | "phone";
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  staffName: string;
  startsAt: Date;
  endsAt: Date;
  items: { name: string; pricePaise: number }[];
  totalPaise: number;
  paidPaise: number;
  notes: string | null;
};

export type EmailContent = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function when(b: BookingSummary) {
  return `${formatDate(toIst(b.startsAt).date)}, ${formatInstantTime(b.startsAt)} – ${formatInstantTime(b.endsAt)}`;
}

function rows(pairs: [string, string][]) {
  return pairs
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#5f6672;vertical-align:top">${escapeHtml(k)}</td><td style="padding:4px 0;color:#111827">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
}

function layout(salon: string, heading: string, intro: string, detail: [string, string][], footer: string) {
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f3;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5">
<div style="max-width:520px;margin:0 auto;background:#fdfdfc;border:1px solid #e6e6e1;border-radius:12px;padding:24px">
<p style="margin:0 0 16px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#b8007b">${escapeHtml(salon)}</p>
<h1 style="margin:0 0 8px;font-size:20px;color:#111827">${escapeHtml(heading)}</h1>
<p style="margin:0 0 16px;color:#5f6672">${escapeHtml(intro)}</p>
<table style="border-collapse:collapse">${rows(detail)}</table>
<p style="margin:16px 0 0;font-size:13px;color:#5f6672">${escapeHtml(footer)}</p>
</div></body></html>`;
  const text = [salon, "", heading, intro, "", ...detail.map(([k, v]) => `${k}: ${v}`), "", footer].join("\n");
  return { html, text };
}

function bookingRows(b: BookingSummary): [string, string][] {
  return [
    ["Booking", b.code],
    ["When", when(b)],
    ["Artist", b.staffName],
    ["Services", b.items.map((i) => i.name).join(", ")],
    ["Total", formatINR(b.totalPaise)],
    ["Paid online", formatINR(b.paidPaise)],
    ["Due at the studio", formatINR(Math.max(0, b.totalPaise - b.paidPaise))],
  ];
}

/** To the owner: a new online booking is confirmed. */
export function ownerBookingConfirmedEmail(b: BookingSummary, salon: string): EmailContent {
  const { html, text } = layout(
    salon,
    `New booking: ${b.customerName}`,
    `${when(b)} with ${b.staffName}.`,
    [
      ...bookingRows(b),
      ["Customer", `${b.customerName} · ${formatIndianMobile(b.customerPhone)}`],
      ...(b.notes ? ([["Notes", b.notes]] as [string, string][]) : []),
    ],
    "Open the admin calendar for details.",
  );
  return { subject: `New booking ${b.code}: ${b.customerName}, ${formatDate(toIst(b.startsAt).date)} ${formatInstantTime(b.startsAt)}`, html, text };
}

/** To the owner: money was taken but needs attention (refund due, slot taken, amount mismatch). */
export function ownerPaymentReviewEmail(b: BookingSummary, reason: string, salon: string): EmailContent {
  const { html, text } = layout(
    salon,
    `Payment needs attention: ${b.code}`,
    reason,
    [...bookingRows(b), ["Customer", `${b.customerName} · ${formatIndianMobile(b.customerPhone)}`]],
    "Check the booking in the admin and refund it from there if needed.",
  );
  return { subject: `Action needed: payment for ${b.code}`, html, text };
}

/** To the customer: their booking is confirmed. */
export function customerConfirmationEmail(b: BookingSummary, salon: string, extra: { address: string; cancelWindowHours: number }): EmailContent {
  const { html, text } = layout(
    salon,
    `You're booked, ${b.customerName.split(" ")[0]}!`,
    `See you on ${when(b)}.`,
    [...bookingRows(b), ...(extra.address ? ([["Where", extra.address]] as [string, string][]) : [])],
    b.paidPaise > 0
      ? `Free cancellation up to ${extra.cancelWindowHours} hours before. After that, the amount paid online isn't refundable. The calendar invite is attached.`
      : `Please let us know at least ${extra.cancelWindowHours} hours before if you can't make it. The calendar invite is attached.`,
  );
  return { subject: `Booking confirmed: ${formatDate(toIst(b.startsAt).date)} at ${formatInstantTime(b.startsAt)} (${b.code})`, html, text };
}

/** To the customer: a refund has been started. */
export function customerRefundEmail(b: BookingSummary, amountPaise: number, salon: string): EmailContent {
  const { html, text } = layout(
    salon,
    `Your refund of ${formatINR(amountPaise)} is on its way`,
    `We've refunded ${formatINR(amountPaise)} for booking ${b.code} to the card, UPI account, bank or wallet you paid with.`,
    [
      ["Booking", b.code],
      ["Appointment", when(b)],
      ["Refund", formatINR(amountPaise)],
    ],
    "Banks usually take 5–7 working days to show it in your account. Reply to this email if it hasn't arrived by then.",
  );
  return { subject: `Refund of ${formatINR(amountPaise)} started (${b.code})`, html, text };
}

/** To the owner: Razorpay couldn't complete a refund, so the money is still with the salon. */
export function ownerRefundFailedEmail(b: BookingSummary, amountPaise: number, reason: string, salon: string): EmailContent {
  const { html, text } = layout(
    salon,
    `Refund failed: ${b.code}`,
    `The refund of ${formatINR(amountPaise)} to ${b.customerName} didn't go through. ${reason}`,
    [...bookingRows(b), ["Customer", `${b.customerName} · ${formatIndianMobile(b.customerPhone)}`]],
    "Open the booking in the admin to try again, or contact the customer.",
  );
  return { subject: `Action needed: refund failed for ${b.code}`, html, text };
}
