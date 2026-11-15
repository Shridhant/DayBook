import { vi } from "vitest";

// Next's cache APIs only work inside a running Next server. Domain code calls them after writes;
// in tests they're no-ops we can assert on.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

// `after()` needs a live request; in tests the callback is simply not scheduled.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));
