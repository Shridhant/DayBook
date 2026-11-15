import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const fileEnv = loadEnv("test", process.cwd(), "");

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // `server-only` throws outside Next's server bundle; it's a no-op for tests.
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Test files share one database with global tables (settings, notifications, email outbox),
    // so they run one after another to stay deterministic.
    fileParallelism: false,
    // Loads .env.local etc. Tests must only ever use the *_TEST database URLs.
    // TZ is deliberately NOT India: proves the time helpers never depend on the machine's timezone.
    // DATABASE_URL is swapped for the test database so code using lib/db.ts can never reach dev data.
    env: {
      ...fileEnv,
      DATABASE_URL: fileEnv.DATABASE_URL_TEST,
      TZ: "America/New_York",
      // Fake Razorpay credentials: tests stub fetch, so nothing ever reaches Razorpay.
      RAZORPAY_KEY_ID: "rzp_test_dummy123",
      RAZORPAY_KEY_SECRET: "test_key_secret_123",
      RAZORPAY_WEBHOOK_SECRET: "test_webhook_secret_123",
      // Uploads in tests go to a throwaway folder, never the real storage.
      UPLOAD_DIR: join(tmpdir(), "daybook-test-uploads"),
      // Email in tests: never configured (nothing can be sent), with known owner addresses.
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: "",
      EMAIL_FROM: "",
      OWNER_NOTIFY_EMAILS: "owner-a@daybook.test, owner-b@daybook.test",
    },
  },
});
