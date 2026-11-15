import { describe, expect, it } from "vitest";
import { fromIst, timeToMinutes, type DateKey } from "@/lib/time";
import {
  bookedMinutes,
  computeSlots,
  isBlocking,
  isStaffFree,
  rankStaff,
  type AvailabilityInput,
  type CandidateStaff,
  type ExistingBooking,
} from "@/server/availability";

/* ---------- Fixtures ---------- */

const DATE: DateKey = "2026-11-20"; // a Friday
const NOW = fromIst("2026-11-15", timeToMinutes("10:00")); // five days earlier
const t = (hhmm: string) => timeToMinutes(hhmm);
const at = (hhmm: string, date: DateKey = DATE) => fromIst(date, t(hhmm));

function staff(id: string, overrides: Partial<CandidateStaff> = {}): CandidateStaff {
  return { id, sortOrder: 1, shifts: [{ start: t("11:00"), end: t("20:00") }], bookings: [], leave: [], ...overrides };
}

function booking(from: string, to: string, status: ExistingBooking["status"] = "confirmed", holdExpiresAt: Date | null = null): ExistingBooking {
  return { start: at(from), end: at(to), status, holdExpiresAt };
}

function input(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    date: DATE,
    now: NOW,
    durationMin: 60,
    rules: { slotIntervalMin: 15, leadTimeMin: 60, bookingWindowDays: 30 },
    openingHours: { start: t("11:00"), end: t("20:00") },
    closed: false,
    staff: [staff("a")],
    ...overrides,
  };
}

/** Slot start times as "HH:MM" for readable assertions. */
function times(i: AvailabilityInput) {
  return computeSlots(i).slots.map((s) => {
    const h = Math.floor(s.minutes / 60);
    return `${String(h).padStart(2, "0")}:${String(s.minutes % 60).padStart(2, "0")}`;
  });
}

/* ---------- Tests ---------- */

describe("slot grid and opening hours", () => {
  it("offers every 15 minutes from opening until the service must end at closing", () => {
    const slots = times(input());
    expect(slots[0]).toBe("11:00");
    expect(slots.at(-1)).toBe("19:00");
    expect(slots).toHaveLength(33);
  });

  it("uses the full service duration when checking closing time", () => {
    expect(times(input({ durationMin: 120 })).at(-1)).toBe("18:00");
    expect(times(input({ durationMin: 45 })).at(-1)).toBe("19:15");
  });

  it("aligns the grid to the clock, not to an odd opening time", () => {
    expect(times(input({ openingHours: { start: t("10:50"), end: t("20:00") } }))[0]).toBe("11:00");
    const half = times(input({ rules: { slotIntervalMin: 30, leadTimeMin: 60, bookingWindowDays: 30 } }));
    expect(half.slice(0, 3)).toEqual(["11:00", "11:30", "12:00"]);
  });

  it("never lets a shift extend past opening hours", () => {
    const early = input({ staff: [staff("a", { shifts: [{ start: t("09:00"), end: t("21:00") }] })] });
    const slots = times(early);
    expect(slots[0]).toBe("11:00");
    expect(slots.at(-1)).toBe("19:00");
  });

  it("returns slot instants in UTC for the IST wall-clock time", () => {
    const [first] = computeSlots(input()).slots;
    expect(first.startsAt.toISOString()).toBe("2026-11-20T05:30:00.000Z");
    expect(first.endsAt.toISOString()).toBe("2026-11-20T06:30:00.000Z");
  });
});

describe("shifts", () => {
  it("respects split shifts and never spans the gap", () => {
    const split = staff("a", {
      shifts: [
        { start: t("11:00"), end: t("14:00") },
        { start: t("16:00"), end: t("20:00") },
      ],
    });
    const slots = times(input({ staff: [split] }));
    expect(slots).toContain("13:00"); // 13:00–14:00 fits the morning shift exactly
    expect(slots).not.toContain("13:15"); // would end 14:15, after the shift
    expect(slots).not.toContain("15:30"); // would start in the gap
    expect(slots).toContain("16:00");
  });

  it("offers nothing to a technician with no shift that weekday", () => {
    const result = computeSlots(input({ staff: [staff("a", { shifts: [] })] }));
    expect(result.slots).toEqual([]);
    expect(result.closedReason).toBeNull();
  });
});

describe("existing bookings and holds", () => {
  it("blocks overlapping times but allows back-to-back", () => {
    const busy = staff("a", { bookings: [booking("16:00", "17:00")] });
    const slots = times(input({ staff: [busy] }));
    expect(slots).toContain("15:00"); // ends exactly at 16:00
    expect(slots).not.toContain("15:15");
    expect(slots).not.toContain("16:45");
    expect(slots).toContain("17:00"); // starts exactly at 17:00
  });

  it("treats a live pending hold as busy", () => {
    const held = staff("a", { bookings: [booking("16:00", "17:00", "pending", new Date(NOW.getTime() + 10 * 60_000))] });
    expect(times(input({ staff: [held] }))).not.toContain("16:00");
  });

  it("ignores expired holds and finished-with bookings", () => {
    const stale = staff("a", {
      bookings: [
        booking("16:00", "17:00", "pending", new Date(NOW.getTime() - 60_000)), // hold already lapsed
        booking("16:00", "17:00", "expired"),
        booking("16:00", "17:00", "cancelled", null),
        booking("16:00", "17:00", "no_show"),
      ],
    });
    expect(times(input({ staff: [stale] }))).toContain("16:00");
  });

  it("isBlocking follows the status rules", () => {
    expect(isBlocking(booking("16:00", "17:00", "confirmed"), NOW)).toBe(true);
    expect(isBlocking(booking("16:00", "17:00", "completed"), NOW)).toBe(true);
    expect(isBlocking(booking("16:00", "17:00", "pending", null), NOW)).toBe(false);
    expect(isBlocking(booking("16:00", "17:00", "pending", NOW), NOW)).toBe(false); // expires exactly now
  });
});

describe("leave and closures", () => {
  it("blocks approved leave", () => {
    const away = staff("a", { leave: [{ start: at("14:00"), end: at("16:00") }] });
    const slots = times(input({ staff: [away] }));
    expect(slots).toContain("13:00");
    expect(slots).not.toContain("13:15");
    expect(slots).not.toContain("15:45");
    expect(slots).toContain("16:00");
  });

  it("blocks leave that spans several days", () => {
    const away = staff("a", { leave: [{ start: at("00:00", "2026-11-19"), end: at("00:00", "2026-11-22") }] });
    expect(times(input({ staff: [away] }))).toEqual([]);
  });

  it("closes the day for a salon closure or a closed weekday", () => {
    expect(computeSlots(input({ closed: true }))).toEqual({ slots: [], closedReason: "closed" });
    expect(computeSlots(input({ openingHours: null }))).toEqual({ slots: [], closedReason: "closed" });
  });

  it("reports when no technician can do the services", () => {
    expect(computeSlots(input({ staff: [] }))).toEqual({ slots: [], closedReason: "no_staff" });
  });
});

describe("booking window and lead time", () => {
  it("rejects past dates", () => {
    expect(computeSlots(input({ date: "2026-11-14" })).closedReason).toBe("past");
  });

  it("allows the last day of the window and rejects the day after", () => {
    // Window of 30 days starting today (15 Nov) → last bookable day is 14 Dec.
    expect(computeSlots(input({ date: "2026-12-14" })).closedReason).toBeNull();
    expect(computeSlots(input({ date: "2026-12-15" })).closedReason).toBe("outside_window");
  });

  it("skips slots inside the lead time today", () => {
    const now = at("14:10"); // today, 14:10 IST, 60 min lead → earliest 15:10
    const slots = times(input({ now }));
    expect(slots[0]).toBe("15:15");
  });

  it("uses the IST date, so just after IST midnight it's already 'today'", () => {
    // 18:45 UTC on 19 Nov = 00:15 IST on 20 Nov.
    const now = new Date("2026-11-19T18:45:00Z");
    const result = computeSlots(input({ now }));
    expect(result.closedReason).toBeNull();
    expect(times(input({ now }))[0]).toBe("11:00");
    expect(computeSlots(input({ now, date: "2026-11-19" })).closedReason).toBe("past");
  });

  it("returns nothing once today's last slot has passed", () => {
    expect(times(input({ now: at("19:30") }))).toEqual([]);
  });
});

describe("several technicians and 'Any available'", () => {
  it("offers a slot if any technician is free, listing only the free ones", () => {
    const a = staff("a", { bookings: [booking("16:00", "17:00")] });
    const b = staff("b", { sortOrder: 2 });
    const slot = computeSlots(input({ staff: [a, b] })).slots.find((s) => s.minutes === t("16:00"));
    expect(slot?.staffIds).toEqual(["b"]);
  });

  it("ranks the least-booked technician first", () => {
    const a = staff("a", { sortOrder: 1, bookings: [booking("11:00", "13:00")] }); // 120 min
    const b = staff("b", { sortOrder: 2, bookings: [booking("11:00", "12:00")] }); // 60 min
    const c = staff("c", { sortOrder: 3 }); // 0 min
    const slot = computeSlots(input({ staff: [a, b, c] })).slots.find((s) => s.minutes === t("17:00"));
    expect(slot?.staffIds).toEqual(["c", "b", "a"]);
  });

  it("breaks ties by sort order, then id", () => {
    const ranked = rankStaff([staff("z", { sortOrder: 2 }), staff("y", { sortOrder: 1 }), staff("x", { sortOrder: 2 })], NOW);
    expect(ranked.map((s) => s.id)).toEqual(["y", "x", "z"]);
  });

  it("doesn't count expired holds as workload", () => {
    const a = staff("a", { bookings: [booking("11:00", "13:00", "pending", new Date(NOW.getTime() - 1))] });
    expect(bookedMinutes(a, NOW)).toBe(0);
  });

  it("isStaffFree checks shift, leave and bookings for a single interval", () => {
    const a = staff("a", { bookings: [booking("16:00", "17:00")], leave: [{ start: at("12:00"), end: at("13:00") }] });
    expect(isStaffFree(a, DATE, t("14:00"), t("15:00"), NOW)).toBe(true);
    expect(isStaffFree(a, DATE, t("16:30"), t("17:30"), NOW)).toBe(false);
    expect(isStaffFree(a, DATE, t("12:30"), t("13:30"), NOW)).toBe(false);
    expect(isStaffFree(a, DATE, t("19:30"), t("20:30"), NOW)).toBe(false);
  });
});

describe("input validation", () => {
  it("throws on a non-positive duration or interval", () => {
    expect(() => computeSlots(input({ durationMin: 0 }))).toThrow(RangeError);
    expect(() => computeSlots(input({ rules: { slotIntervalMin: 0, leadTimeMin: 0, bookingWindowDays: 30 } }))).toThrow(RangeError);
  });
});
