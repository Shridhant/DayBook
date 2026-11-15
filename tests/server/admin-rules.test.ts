import { describe, expect, it } from "vitest";
import { slugify } from "@/server/admin/http";
import { checkTeamChange, leaveRange, outsideShifts, validateShifts } from "@/server/admin/rules";

describe("validateShifts", () => {
  it("accepts and sorts a normal week with a split shift", () => {
    const result = validateShifts([
      { weekday: 1, start: "16:00", end: "20:00" },
      { weekday: 1, start: "11:00", end: "14:00" },
      { weekday: 0, start: "11:00", end: "20:00" },
    ]);
    expect(result).toEqual({
      shifts: [
        { weekday: 0, start: 660, end: 1200 },
        { weekday: 1, start: 660, end: 840 },
        { weekday: 1, start: 960, end: 1200 },
      ],
    });
  });

  it("allows back-to-back shifts but rejects overlaps", () => {
    expect(validateShifts([{ weekday: 2, start: "11:00", end: "14:00" }, { weekday: 2, start: "14:00", end: "18:00" }])).toHaveProperty("shifts");
    expect(validateShifts([{ weekday: 2, start: "11:00", end: "15:00" }, { weekday: 2, start: "14:00", end: "18:00" }])).toEqual({
      error: "Shifts on Tuesday overlap.",
    });
  });

  it("rejects end before start, odd minutes, bad weekdays and too many shifts", () => {
    expect(validateShifts([{ weekday: 3, start: "18:00", end: "11:00" }])).toHaveProperty("error");
    expect(validateShifts([{ weekday: 3, start: "11:03", end: "18:00" }])).toHaveProperty("error");
    expect(validateShifts([{ weekday: 7, start: "11:00", end: "18:00" }])).toHaveProperty("error");
    expect(validateShifts([{ weekday: 3, start: "25:00", end: "26:00" }])).toHaveProperty("error");
    const four = ["09:00", "11:00", "13:00", "15:00"].map((start, i) => ({ weekday: 4, start, end: `${10 + i * 2}:00` }));
    expect(validateShifts(four)).toEqual({ error: "At most 3 shifts on Thursday." });
  });

  it("allows a shift ending at midnight", () => {
    expect(validateShifts([{ weekday: 5, start: "18:00", end: "24:00" }])).toEqual({ shifts: [{ weekday: 5, start: 1080, end: 1440 }] });
  });
});

describe("outsideShifts", () => {
  const shifts = [{ weekday: 1, start: 660, end: 840 }];
  it("finds bookings no longer covered", () => {
    const bookings = [
      { id: "inside", weekday: 1, startMin: 660, endMin: 720 },
      { id: "spills", weekday: 1, startMin: 810, endMin: 870 },
      { id: "other-day", weekday: 2, startMin: 700, endMin: 760 },
    ];
    expect(outsideShifts(bookings, shifts).map((b) => b.id)).toEqual(["spills", "other-day"]);
  });
});

describe("leaveRange", () => {
  it("covers whole days in IST by default", () => {
    const r = leaveRange({ startDate: "2026-12-24", endDate: "2026-12-26" });
    expect(r).toEqual({ start: new Date("2026-12-23T18:30:00Z"), end: new Date("2026-12-26T18:30:00Z") });
  });

  it("narrows to times for part of a day", () => {
    const r = leaveRange({ startDate: "2026-12-24", endDate: "2026-12-24", startTime: "14:00", endTime: "17:00" });
    expect(r).toEqual({ start: new Date("2026-12-24T08:30:00Z"), end: new Date("2026-12-24T11:30:00Z") });
  });

  it("rejects reversed, empty and very long ranges", () => {
    expect(leaveRange({ startDate: "2026-12-26", endDate: "2026-12-24" })).toHaveProperty("error");
    expect(leaveRange({ startDate: "2026-12-24", endDate: "2026-12-24", startTime: "17:00", endTime: "14:00" })).toHaveProperty("error");
    expect(leaveRange({ startDate: "2026-01-01", endDate: "2026-06-01" })).toHaveProperty("error");
    expect(leaveRange({ startDate: "nope", endDate: "2026-06-01" })).toHaveProperty("error");
  });
});

describe("checkTeamChange", () => {
  const owner = { id: "o1", role: "owner" as const, active: true };
  const desk = { id: "d1", role: "receptionist" as const, active: true };

  it("lets an owner manage other people", () => {
    expect(checkTeamChange({ actorId: "o1", target: desk, change: { active: false }, activeOwnerCount: 1 })).toBeNull();
    expect(checkTeamChange({ actorId: "o1", target: desk, change: { role: "owner" }, activeOwnerCount: 1 })).toBeNull();
  });

  it("stops you demoting or deactivating yourself", () => {
    expect(checkTeamChange({ actorId: "o1", target: owner, change: { active: false }, activeOwnerCount: 2 })).toMatch(/yourself/);
    expect(checkTeamChange({ actorId: "o1", target: owner, change: { role: "receptionist" }, activeOwnerCount: 2 })).toMatch(/own role/);
  });

  it("always keeps one active owner", () => {
    const other = { id: "o2", role: "owner" as const, active: true };
    expect(checkTeamChange({ actorId: "o1", target: other, change: { active: false }, activeOwnerCount: 1 })).toMatch(/at least one/);
    expect(checkTeamChange({ actorId: "o1", target: other, change: { active: false }, activeOwnerCount: 2 })).toBeNull();
  });

  it("allows harmless no-op changes to yourself", () => {
    expect(checkTeamChange({ actorId: "o1", target: owner, change: { role: "owner", active: true }, activeOwnerCount: 1 })).toBeNull();
  });
});

describe("slugify", () => {
  it.each([
    ["Gel Extensions (Full set)", "gel-extensions-full-set"],
    ["  Riya  Sharma ", "riya-sharma"],
    ["Café crème", "cafe-creme"],
    ["!!!", "item"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
