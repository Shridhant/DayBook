import { describe, expect, it } from "vitest";
import { formatINR, isPaise, paiseToRupeesInput, percentOf, rupeesToPaise, sumPaise } from "@/lib/money";

describe("isPaise / sumPaise", () => {
  it("accepts only non-negative safe integers", () => {
    expect(isPaise(0)).toBe(true);
    expect(isPaise(120000)).toBe(true);
    expect(isPaise(-1)).toBe(false);
    expect(isPaise(12.5)).toBe(false);
    expect(isPaise(Number.NaN)).toBe(false);
    expect(isPaise("100")).toBe(false);
  });

  it("sums and rejects invalid parts", () => {
    expect(sumPaise(120000, 50000, 80000)).toBe(250000);
    expect(sumPaise()).toBe(0);
    expect(() => sumPaise(100, 0.5)).toThrow(RangeError);
  });
});

describe("percentOf", () => {
  it("computes exact percentages", () => {
    expect(percentOf(250000, 20)).toBe(50000);
    expect(percentOf(185000, 20)).toBe(37000);
    expect(percentOf(100000, 0)).toBe(0);
    expect(percentOf(100000, 100)).toBe(100000);
  });

  it("rounds half-up to the nearest paisa", () => {
    expect(percentOf(123450, 15)).toBe(18518); // 18517.5 → 18518
    expect(percentOf(333, 10)).toBe(33); // 33.3 → 33
    expect(percentOf(335, 10)).toBe(34); // 33.5 → 34
  });

  it("rejects bad input", () => {
    expect(() => percentOf(100, 101)).toThrow(RangeError);
    expect(() => percentOf(100, 12.5)).toThrow(RangeError);
    expect(() => percentOf(-100, 10)).toThrow(RangeError);
  });
});

describe("rupeesToPaise", () => {
  it("parses what people type", () => {
    expect(rupeesToPaise("1200")).toBe(120000);
    expect(rupeesToPaise("1,200")).toBe(120000);
    expect(rupeesToPaise("₹ 1,20,000")).toBe(12000000);
    expect(rupeesToPaise("Rs. 500")).toBe(50000);
    expect(rupeesToPaise("1200.5")).toBe(120050);
    expect(rupeesToPaise("1200.05")).toBe(120005);
    expect(rupeesToPaise(" 0 ")).toBe(0);
  });

  it("is exact for numbers that are inexact as floats", () => {
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(rupeesToPaise(0.1)).toBe(10);
    expect(rupeesToPaise(1200)).toBe(120000);
  });

  it("rejects anything ambiguous", () => {
    for (const bad of ["", "abc", "-5", "12.345", "1.2.3", "1e3", ".5"]) {
      expect(rupeesToPaise(bad), bad).toBeNull();
    }
  });

  it("round-trips through the form-input format", () => {
    for (const paise of [0, 50000, 120050, 120005, 12000000]) {
      expect(rupeesToPaise(paiseToRupeesInput(paise))).toBe(paise);
    }
    expect(paiseToRupeesInput(120050)).toBe("1200.50");
  });
});

describe("formatINR", () => {
  it("drops paise for whole rupees", () => {
    expect(formatINR(0)).toBe("₹0");
    expect(formatINR(50000)).toBe("₹500");
    expect(formatINR(120000)).toBe("₹1,200");
  });

  it("uses Indian digit grouping", () => {
    expect(formatINR(12000000)).toBe("₹1,20,000");
    expect(formatINR(1234567800)).toBe("₹1,23,45,678");
  });

  it("shows paise when present", () => {
    expect(formatINR(120050)).toBe("₹1,200.50");
    expect(formatINR(5)).toBe("₹0.05");
  });

  it("rejects non-paise values", () => {
    expect(() => formatINR(12.5)).toThrow(RangeError);
    expect(() => formatINR(-100)).toThrow(RangeError);
  });
});
