import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatDate,
  formatDuration,
  formatInstantTime,
  formatLeaveRange,
  formatTime,
  fromIst,
  isDateKey,
  istDayRange,
  istToday,
  minutesToTime,
  parseDateKey,
  timeToMinutes,
  toIst,
  weekdayOf,
} from "@/lib/time";

describe("test environment", () => {
  it("runs in a non-IST timezone so helpers can't lean on the machine clock", () => {
    // Set in vitest.config.mts. If this fails, the other tests prove nothing about timezone safety.
    expect(process.env.TZ).toBe("America/New_York");
    expect(new Date("2026-11-15T12:00:00Z").getTimezoneOffset()).not.toBe(-330);
  });
});

describe("DateKey parsing and arithmetic", () => {
  it("parses valid keys and rejects impossible or malformed ones", () => {
    expect(parseDateKey("2026-11-15")).toEqual({ year: 2026, month: 11, day: 15 });
    expect(parseDateKey("2028-02-29")).not.toBeNull(); // leap year
    for (const bad of ["2026-02-30", "2027-02-29", "2026-13-01", "2026-1-5", "15-11-2026", "", "2026-11-15T00:00"]) {
      expect(parseDateKey(bad), bad).toBeNull();
    }
    expect(isDateKey("2026-11-15")).toBe(true);
    expect(isDateKey(20261115)).toBe(false);
  });

  it("adds days across month, year and leap-day boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-11-15", -15)).toBe("2026-10-31");
    expect(addDays("2026-11-15", 30)).toBe("2026-12-15");
  });

  it("is unaffected by US daylight-saving changes (machine is in New York)", () => {
    // DST started in the US on 2024-03-10; local-time arithmetic would drift by an hour here.
    expect(addDays("2024-03-09", 1)).toBe("2024-03-10");
    expect(addDays("2024-03-10", 1)).toBe("2024-03-11");
  });

  it("counts days between keys", () => {
    expect(daysBetween("2026-11-15", "2026-12-15")).toBe(30);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-11-15", "2026-11-10")).toBe(-5);
  });

  it("knows the weekday (0 = Sunday)", () => {
    expect(weekdayOf("2026-11-15")).toBe(0);
    expect(weekdayOf("2026-12-31")).toBe(4);
    expect(weekdayOf("2027-01-01")).toBe(5);
    expect(weekdayOf("2028-02-29")).toBe(2);
  });

  it("throws on invalid keys instead of producing a wrong date", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
    expect(() => weekdayOf("nope")).toThrow(RangeError);
  });
});

describe("instants ↔ IST", () => {
  it("converts around IST midnight (UTC 18:30)", () => {
    expect(toIst(new Date("2026-11-15T18:29:00Z"))).toEqual({ date: "2026-11-15", minutes: 1439, weekday: 0 });
    expect(toIst(new Date("2026-11-15T18:30:00Z"))).toEqual({ date: "2026-11-16", minutes: 0, weekday: 1 });
  });

  it("converts a normal afternoon", () => {
    // 11:00 UTC = 16:30 IST
    expect(toIst(new Date("2026-11-15T11:00:00Z"))).toEqual({ date: "2026-11-15", minutes: 990, weekday: 0 });
  });

  it("builds instants from IST wall-clock time", () => {
    expect(fromIst("2026-11-15", 990).toISOString()).toBe("2026-11-15T11:00:00.000Z");
    expect(fromIst("2026-11-16", 0).toISOString()).toBe("2026-11-15T18:30:00.000Z");
    // 1440 = the following IST midnight, which is 18:30 UTC on the same calendar date.
    expect(fromIst("2026-11-15", 1440).toISOString()).toBe("2026-11-15T18:30:00.000Z");
  });

  it("round-trips every 15 minutes of a day", () => {
    for (let m = 0; m < 1440; m += 15) {
      expect(toIst(fromIst("2026-12-31", m))).toMatchObject({ date: "2026-12-31", minutes: m });
    }
  });

  it("gives today's IST date even when it is still yesterday in UTC", () => {
    expect(istToday(new Date("2026-11-15T20:00:00Z"))).toBe("2026-11-16");
    expect(istToday(new Date("2026-11-15T10:00:00Z"))).toBe("2026-11-15");
  });

  it("returns a day's [start, end) range in UTC", () => {
    const { start, end } = istDayRange("2026-11-15");
    expect(start.toISOString()).toBe("2026-11-14T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-11-15T18:30:00.000Z");
  });
});

describe("wall-clock minutes", () => {
  it("parses HH:MM and Postgres HH:MM:SS", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("11:00")).toBe(660);
    expect(timeToMinutes("20:00:00")).toBe(1200);
    expect(timeToMinutes("24:00")).toBe(1440);
  });

  it("rejects invalid times", () => {
    for (const bad of ["24:01", "12:60", "9:00", "12:00:30", "noon", ""]) {
      expect(() => timeToMinutes(bad), bad).toThrow(RangeError);
    }
  });

  it("formats minutes back to HH:MM", () => {
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(990)).toBe("16:30");
    expect(minutesToTime(1440)).toBe("24:00");
    expect(() => minutesToTime(1441)).toThrow(RangeError);
    expect(() => minutesToTime(12.5)).toThrow(RangeError);
  });
});

describe("display formatting", () => {
  it("formats 12-hour times", () => {
    expect(formatTime(0)).toBe("12:00 am");
    expect(formatTime(5)).toBe("12:05 am");
    expect(formatTime(660)).toBe("11:00 am");
    expect(formatTime(720)).toBe("12:00 pm");
    expect(formatTime(990)).toBe("4:30 pm");
    expect(formatTime(1439)).toBe("11:59 pm");
  });

  it("formats an instant in IST, not machine time", () => {
    expect(formatInstantTime(new Date("2026-11-15T11:00:00Z"))).toBe("4:30 pm");
  });

  it("formats dates as 'Sun, 15 Nov'", () => {
    expect(formatDate("2026-11-15")).toBe("Sun, 15 Nov");
    expect(formatDate("2027-01-01", { year: true })).toBe("Fri, 1 Jan 2027");
  });

  it("formats durations", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(150)).toBe("2h 30m");
    expect(() => formatDuration(-5)).toThrow(RangeError);
  });
});

describe("formatLeaveRange", () => {
  const at = (date: string, time: string) => fromIst(date, timeToMinutes(time));

  it("shows one whole day as a date", () => {
    expect(formatLeaveRange(at("2026-11-21", "00:00"), at("2026-11-22", "00:00"))).toBe("Sat, 21 Nov");
  });

  it("shows several whole days with an inclusive end date", () => {
    expect(formatLeaveRange(at("2026-11-21", "00:00"), at("2026-11-24", "00:00"))).toBe("Sat, 21 Nov – Mon, 23 Nov");
  });

  it("shows times for part of a day", () => {
    expect(formatLeaveRange(at("2026-11-21", "14:00"), at("2026-11-21", "17:00"))).toBe("Sat, 21 Nov, 2:00 pm – 5:00 pm");
  });

  it("shows both dates when part-day leave spans days", () => {
    expect(formatLeaveRange(at("2026-11-21", "14:00"), at("2026-11-22", "12:00"))).toBe("Sat, 21 Nov, 2:00 pm – Sun, 22 Nov, 12:00 pm");
  });
});
