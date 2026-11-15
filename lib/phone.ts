import { z } from "zod";

/**
 * Indian mobile numbers (AGENTS.md §7 "Customers"): the phone number is the customer's identity,
 * so every number is stored in one canonical form: 10 digits starting with 6–9.
 */

const MOBILE = /^[6-9]\d{9}$/;

/**
 * Accepts what people actually type ("+91 98765-43210", "098765 43210", "0091 9876543210",
 * "(987) 654 3210") and returns "9876543210", or null if it isn't a valid Indian mobile.
 */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 14 && digits.startsWith("0091")) digits = digits.slice(4);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return MOBILE.test(digits) ? digits : null;
}

/** "9876543210" → "+91 98765 43210" for display. */
export function formatIndianMobile(phone: string): string {
  const normalized = normalizeIndianMobile(phone);
  if (!normalized) return phone;
  return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
}

/** "9876543210" → "+919876543210" for tel:/WhatsApp links and Razorpay prefill. */
export function toE164(phone: string): string | null {
  const normalized = normalizeIndianMobile(phone);
  return normalized ? `+91${normalized}` : null;
}

/** zod schema for request bodies and forms: validates and outputs the canonical 10-digit form. */
export const indianMobileSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeIndianMobile(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit Indian mobile number" });
    return z.NEVER;
  }
  return normalized;
});
