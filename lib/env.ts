import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once at startup (AGENTS.md §5).
 * Add every new variable here AND to .env.example.
 */
/** Treats an empty `KEY=` line in .env files as "not set". */
const optional = <T extends z.ZodType>(type: T) => z.preprocess((v) => (v === "" ? undefined : v), type.optional());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // Public origin of the site, used for absolute URLs in link previews (Open Graph).
  SITE_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:3000"),
  // Razorpay. Optional so the app runs without payments configured; payment routes return 503.
  RAZORPAY_KEY_ID: optional(z.string().regex(/^rzp_(test|live)_\w+$/, "Expected rzp_test_… or rzp_live_…")),
  RAZORPAY_KEY_SECRET: optional(z.string().min(8)),
  RAZORPAY_WEBHOOK_SECRET: optional(z.string().min(8)),
  // Uploaded photos live here on the VPS disk (AGENTS.md §9). Include it in backups.
  UPLOAD_DIR: optional(z.string().min(1)).transform((v) => v ?? "./storage/uploads"),
  // Email over SMTP (Hostinger mail, Gmail app password, …). Optional: without it, emails queue
  // in email_outbox and expire after a day instead of being sent.
  SMTP_HOST: optional(z.string().min(1)),
  SMTP_PORT: optional(z.coerce.number().int().positive()).transform((v) => v ?? 587),
  SMTP_USER: optional(z.string().min(1)),
  SMTP_PASS: optional(z.string().min(1)),
  /** e.g. "Daybook <bookings@yoursalon.in>". Must be an address the SMTP account may send from. */
  EMAIL_FROM: optional(z.string().min(3)),
  /** Comma-separated owner addresses for booking alerts. */
  OWNER_NOTIFY_EMAILS: optional(z.string()).transform((v) =>
    (v ?? "").split(",").map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)),
  ),
  /** Shared secret for the email retry cron (GET /api/cron/email). Unset = endpoint disabled. */
  CRON_SECRET: optional(z.string().min(16)),
  // Signs admin session cookies. Required in production (checked below).
  BETTER_AUTH_SECRET: optional(z.string().min(32, "Use at least 32 characters (openssl rand -base64 32)")),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${issues}\nCheck .env.local against .env.example.`);
}

if (parsed.data.NODE_ENV === "production" && !parsed.data.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET must be set in production.");
}

export const env = parsed.data;
