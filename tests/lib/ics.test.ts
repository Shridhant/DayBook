import { describe, expect, it } from "vitest";
import { buildIcs } from "@/lib/ics";

describe("buildIcs", () => {
  const ics = buildIcs({
    uid: "booking-1@daybook",
    title: "Daybook: Gel manicure, Nail art; extras",
    start: new Date("2026-11-20T11:00:00Z"), // 4:30 pm IST
    end: new Date("2026-11-20T12:45:00Z"),
    description: "Booking DB-ABC234 with Riya.\nSee you soon",
    location: "Shop 4, Sector 29, Gurugram",
    now: new Date("2026-11-15T10:00:00Z"),
  });
  const lines = ics.split("\r\n");

  it("writes a valid calendar wrapper with CRLF line endings", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("BEGIN:VEVENT");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it("uses UTC timestamps, so the time is right in any calendar's timezone", () => {
    expect(lines).toContain("DTSTART:20261120T110000Z");
    expect(lines).toContain("DTEND:20261120T124500Z");
    expect(lines).toContain("DTSTAMP:20261115T100000Z");
  });

  it("escapes commas, semicolons and newlines in text", () => {
    expect(lines).toContain("SUMMARY:Daybook: Gel manicure\\, Nail art\\; extras");
    expect(lines).toContain("DESCRIPTION:Booking DB-ABC234 with Riya.\\nSee you soon");
    expect(lines).toContain("LOCATION:Shop 4\\, Sector 29\\, Gurugram");
  });

  it("adds a reminder two hours before", () => {
    expect(lines).toContain("BEGIN:VALARM");
    expect(lines).toContain("TRIGGER:-PT2H");
  });

  it("omits optional fields when not given", () => {
    const minimal = buildIcs({ uid: "x", title: "T", start: new Date(0), end: new Date(60_000) });
    expect(minimal).not.toContain("LOCATION:");
  });
});
