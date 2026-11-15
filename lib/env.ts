import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once at startup (AGENTS.md §5).
 * Add every new variable here AND to .env.example.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${issues}\nCheck .env.local against .env.example.`);
}

export const env = parsed.data;
