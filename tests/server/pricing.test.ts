import { describe, expect, it } from "vitest";
import { bookingAmount, roundToTenRupees, totalPrice, type PricedService } from "@/server/pricing";

const svc = (rupees: number, overrideRupees: number | null = null): PricedService => ({
  pricePaise: rupees * 100,
  bookingAmountOverridePaise: overrideRupees === null ? null : overrideRupees * 100,
});
const fixed = (rupees: number) => ({ type: "fixed" as const, fixedPaise: rupees * 100 });
const percent = (p: number) => ({ type: "percent" as const, percent: p });

describe("roundToTenRupees", () => {
  it.each([
    [24680, 25000], // ₹246.80 → ₹250
    [24500, 25000], // ₹245 → ₹250 (half up)
    [24499, 24000], // ₹244.99 → ₹240
    [37000, 37000], // already a multiple
    [0, 0],
  ])("%i paise → %i", (input, expected) => {
    expect(roundToTenRupees(input)).toBe(expected);
  });

  it("never rounds a positive amount down to zero", () => {
    expect(roundToTenRupees(400)).toBe(1000); // ₹4 → ₹10
  });
});

describe("totalPrice", () => {
  it("adds service prices", () => {
    expect(totalPrice([svc(1200), svc(800)])).toBe(200000);
  });
});

describe("bookingAmount", () => {
  it("uses the fixed amount", () => {
    expect(bookingAmount([svc(1200)], fixed(500))).toBe(50000);
  });

  it("uses a percentage rounded to the nearest ₹10", () => {
    expect(bookingAmount([svc(1234)], percent(20))).toBe(25000); // ₹246.80 → ₹250
    expect(bookingAmount([svc(1200), svc(800)], percent(20))).toBe(40000); // ₹400 exactly
  });

  it("prefers a service override, taking the largest when several apply", () => {
    expect(bookingAmount([svc(2500, 1000)], fixed(500))).toBe(100000);
    expect(bookingAmount([svc(2500, 1000), svc(2800, 1500), svc(800)], percent(20))).toBe(150000);
  });

  it("never charges more than the total", () => {
    expect(bookingAmount([svc(400)], fixed(500))).toBe(40000);
    expect(bookingAmount([svc(300, 1000)], fixed(500))).toBe(30000);
    // 100% of ₹1,236 rounds up to ₹1,240, but the cap keeps it at ₹1,236.
    expect(bookingAmount([svc(1236)], percent(100))).toBe(123600);
  });

  it("allows a zero booking amount when the owner sets it", () => {
    expect(bookingAmount([svc(1200)], fixed(0))).toBe(0);
    expect(bookingAmount([svc(1200)], percent(0))).toBe(0);
  });
});
