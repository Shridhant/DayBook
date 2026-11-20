import { describe, expect, it } from "vitest";
import { addMonths, daysInMonth, isSelectable, monthGrid, monthLabel, monthOf, moveDay, shiftMonths } from "@/lib/calendar";

describe("calendar month rules", () => {
  it("finds the month and steps across years", () => {
    expect(monthOf("2026-11-20")).toBe("2026-11-01");
    expect(addMonths("2026-11-20", 2)).toBe("2027-01-01");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
    expect(addMonths("2026-03-31", -13)).toBe("2025-02-01");
  });

  it("knows month lengths, including leap years", () => {
    expect(daysInMonth("2026-02-01")).toBe(28);
    expect(daysInMonth("2028-02-10")).toBe(29);
    expect(daysInMonth("2026-12-01")).toBe(31);
  });

  it("lays out Monday-first rows", () => {
    // 1 Nov 2026 is a Sunday: six blanks, then 30 days over six rows.
    expect(monthGrid("2026-11-01")).toMatchObject({ offset: 6, rows: 6 });
    expect(monthGrid("2026-11-01").days).toHaveLength(30);
    // Feb 2021 starts on a Monday and fills exactly four rows.
    expect(monthGrid("2021-02-01")).toMatchObject({ offset: 0, rows: 4 });
    expect(monthLabel("2026-11-20")).toEqual({ name: "November", year: "2026" });
  });

  it("blocks days outside min/max and matched days", () => {
    const rules = { min: "2026-11-10", max: "2026-11-30", disabled: (d: string) => d === "2026-11-15" };
    expect(isSelectable("2026-11-09", rules)).toBe(false);
    expect(isSelectable("2026-11-15", rules)).toBe(false);
    expect(isSelectable("2026-11-16", rules)).toBe(true);
    expect(isSelectable("2026-12-01", rules)).toBe(false);
  });

  it("moves focus past blocked days and stops at the bounds", () => {
    const rules = { min: "2026-11-10", max: "2026-11-30", disabled: (d: string) => d === "2026-11-15" };
    expect(moveDay("2026-11-14", 1, rules)).toBe("2026-11-16");
    // A week up lands on the 15th (blocked), so it carries on to the nearest open day that way.
    expect(moveDay("2026-11-22", -7, rules)).toBe("2026-11-14");
    expect(moveDay("2026-11-30", 1, rules)).toBeNull();
    expect(moveDay("2026-11-10", -1, rules)).toBeNull();
  });

  it("keeps the day of month when paging months, clamped to short months", () => {
    expect(shiftMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftMonths("2026-11-20", -12)).toBe("2025-11-20");
  });
});
