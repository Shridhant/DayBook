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
  // Razorpay. Optional so the app runs without payments configured; payment routes return 503.
  RAZORPAY_KEY_ID: optional(z.string().regex(/^rzp_(test|live)_\w+$/, "Expected rzp_test_… or rzp_live_…")),
  RAZORPAY_KEY_SECRET: optional(z.string().min(8)),
  RAZORPAY_WEBHOOK_SECRET: optional(z.string().min(8)),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${issues}\nCheck .env.local against .env.example.`);
}

export const env = parsed.data;
