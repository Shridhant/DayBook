import { describe, expect, it } from "vitest";
import { bucketKeys, bucketStart, change, comparisonRanges, pickBucket, presetRange, previousRange, rangeDays, ratio, resolveRange } from "@/lib/reports";

const TODAY = "2026-11-18"; // a Wednesday

describe("report ranges", () => {
  it("resolves presets in IST calendar days", () => {
    expect(presetRange("this_month", TODAY)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(presetRange("last_month", TODAY)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(presetRange("last_7", TODAY)).toEqual({ from: "2026-11-12", to: "2026-11-18" });
    expect(presetRange("last_30", TODAY)).toEqual({ from: "2026-10-20", to: "2026-11-18" });
    expect(presetRange("this_year", TODAY)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(presetRange("next_14", TODAY)).toEqual({ from: "2026-11-18", to: "2026-12-01" });
    expect(presetRange("last_month", "2026-01-10")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(presetRange("this_month", "2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("accepts custom dates, swaps reversed ones, caps very long ranges and falls back to this month", () => {
    expect(resolveRange({ preset: "custom", from: "2026-11-10", to: "2026-11-01" }, TODAY)).toEqual({
      preset: "custom",
      range: { from: "2026-11-01", to: "2026-11-10" },
    });
    const long = resolveRange({ preset: "custom", from: "2020-01-01", to: "2026-11-18" }, TODAY);
    expect(rangeDays(long.range)).toBe(731);
    expect(long.range.to).toBe("2026-11-18");
    expect(resolveRange({ preset: "custom", from: "nope", to: "2026-11-01" }, TODAY)).toEqual({
      preset: "this_month",
      range: { from: "2026-11-01", to: "2026-11-30" },
    });
    expect(resolveRange({ preset: "last_7", from: "2020-01-01", to: "2020-02-01" }, TODAY).range.from).toBe("2026-11-12");
  });

  it("compares a whole month with the previous month, anything else with the same number of days before", () => {
    expect(previousRange({ from: "2026-03-01", to: "2026-03-31" })).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(previousRange({ from: "2026-11-12", to: "2026-11-18" })).toEqual({ from: "2026-11-05", to: "2026-11-11" });
    expect(previousRange({ from: "2026-11-01", to: "2026-11-15" })).toEqual({ from: "2026-10-17", to: "2026-10-31" });
  });
});

describe("KPI comparison windows", () => {
  it("compares a finished period in full", () => {
    expect(comparisonRanges({ from: "2026-10-01", to: "2026-10-31" }, TODAY)).toEqual({
      current: { from: "2026-10-01", to: "2026-10-31" },
      previous: { from: "2026-09-01", to: "2026-09-30" },
    });
  });

  it("compares a period in progress only up to today, against the same days of the previous one", () => {
    expect(comparisonRanges({ from: "2026-11-01", to: "2026-11-30" }, TODAY)).toEqual({
      current: { from: "2026-11-01", to: "2026-11-18" },
      previous: { from: "2026-10-01", to: "2026-10-18" },
    });
    // Never runs past the end of a shorter previous month.
    expect(comparisonRanges({ from: "2026-03-01", to: "2026-03-31" }, "2026-03-30")?.previous).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("has nothing to compare for a period that hasn't started", () => {
    expect(comparisonRanges({ from: "2026-11-19", to: "2026-12-02" }, TODAY)).toBeNull();
  });
});

describe("chart buckets", () => {
  it("uses days up to ~a month, weeks up to ~4 months, then months", () => {
    expect(pickBucket({ from: "2026-11-01", to: "2026-11-30" })).toBe("day");
    expect(pickBucket({ from: "2026-08-20", to: "2026-11-18" })).toBe("week");
    expect(pickBucket({ from: "2026-01-01", to: "2026-12-31" })).toBe("month");
  });

  it("starts weeks on Monday and lists every bucket, including empty ones", () => {
    expect(bucketStart("2026-11-18", "week")).toBe("2026-11-16");
    expect(bucketStart("2026-11-22", "week")).toBe("2026-11-16"); // Sunday belongs to the week before
    expect(bucketKeys({ from: "2026-11-18", to: "2026-12-01" }, "week")).toEqual(["2026-11-16", "2026-11-23", "2026-11-30"]);
    expect(bucketKeys({ from: "2026-10-15", to: "2027-01-02" }, "month")).toEqual(["2026-10-01", "2026-11-01", "2026-12-01", "2027-01-01"]);
    expect(bucketKeys({ from: "2026-11-29", to: "2026-12-01" }, "day")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
  });
});

describe("change and ratio", () => {
  it("returns null instead of dividing by zero", () => {
    expect(change(120, 100)).toBeCloseTo(0.2);
    expect(change(80, 100)).toBeCloseTo(-0.2);
    expect(change(5, 0)).toBeNull();
    expect(ratio(1, 4)).toBe(0.25);
    expect(ratio(0, 0)).toBeNull();
  });
});
