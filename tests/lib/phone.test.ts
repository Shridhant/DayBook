import { describe, expect, it } from "vitest";
import { formatIndianMobile, indianMobileSchema, normalizeIndianMobile, toE164 } from "@/lib/phone";

describe("normalizeIndianMobile", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["98765 43210", "9876543210"],
    ["98765-43210", "9876543210"],
    ["+91 98765 43210", "9876543210"],
    ["+91-9876543210", "9876543210"],
    ["919876543210", "9876543210"],
    ["09876543210", "9876543210"],
    ["0091 98765 43210", "9876543210"],
    ["(987) 654-3210", "9876543210"],
    ["6000000000", "6000000000"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each([
    ["5876543210", "starts with 5"],
    ["1234567890", "starts with 1"],
    ["987654321", "9 digits"],
    ["98765432101", "11 digits without leading 0"],
    ["+1 415 555 0100", "US number"],
    ["+44 7700 900123", "UK number"],
    ["919876543", "91 prefix but too short"],
    ["", "empty"],
    ["phone", "letters"],
  ])("rejects %s (%s)", (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });

  it("does not mistake a 10-digit number starting with 91 for a country code", () => {
    expect(normalizeIndianMobile("9198765432")).toBe("9198765432");
  });
});

describe("formatting", () => {
  it("formats for display", () => {
    expect(formatIndianMobile("9876543210")).toBe("+91 98765 43210");
    expect(formatIndianMobile("+919876543210")).toBe("+91 98765 43210");
    expect(formatIndianMobile("not a phone")).toBe("not a phone");
  });

  it("formats E.164 for links and payment prefill", () => {
    expect(toE164("098765 43210")).toBe("+919876543210");
    expect(toE164("12345")).toBeNull();
  });
});

describe("indianMobileSchema", () => {
  it("outputs the canonical form", () => {
    expect(indianMobileSchema.parse("+91 98765 43210")).toBe("9876543210");
  });

  it("fails with a readable message", () => {
    const result = indianMobileSchema.safeParse("12345");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter a valid 10-digit Indian mobile number");
  });
});
