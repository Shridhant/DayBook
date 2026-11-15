import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

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
    // Loads .env.local etc. Tests must only ever use the *_TEST database URLs.
    // TZ is deliberately NOT India: proves the time helpers never depend on the machine's timezone.
    env: { ...loadEnv("test", process.cwd(), ""), TZ: "America/New_York" },
  },
});
