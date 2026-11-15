import { vi } from "vitest";

// Next's cache APIs only work inside a running Next server. Domain code calls them after writes;
// in tests they're no-ops we can assert on.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
