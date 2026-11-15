import { describe, expect, it } from "vitest";
import type { BookingStatus } from "@/server/availability";
import { availableActions, nextStatus, STAFF_EDIT_DAYS, staffActions } from "@/lib/booking-status";

const ALL: BookingStatus[] = ["pending", "confirmed", "completed", "no_show", "cancelled", "expired"];

describe("booking status transitions", () => {
  it("allows the documented transitions", () => {
    expect(nextStatus("confirmed", "complete")).toBe("completed");
    expect(nextStatus("confirmed", "no_show")).toBe("no_show");
    expect(nextStatus("confirmed", "cancel")).toBe("cancelled");
    expect(nextStatus("pending", "cancel")).toBe("cancelled");
    expect(nextStatus("completed", "reopen")).toBe("confirmed");
    expect(nextStatus("no_show", "reopen")).toBe("confirmed");
  });

  it("never brings a cancelled or expired booking back (its slot may be rebooked)", () => {
    for (const action of ["complete", "no_show", "cancel", "reopen"] as const) {
      expect(nextStatus("cancelled", action)).toBeNull();
      expect(nextStatus("expired", action)).toBeNull();
    }
  });

  it("doesn't let a pending hold be completed or marked no-show", () => {
    expect(nextStatus("pending", "complete")).toBeNull();
    expect(nextStatus("pending", "no_show")).toBeNull();
  });

  it("lists the actions the UI should offer", () => {
    expect(availableActions("confirmed")).toEqual(["complete", "no_show", "cancel"]);
    expect(availableActions("pending")).toEqual(["cancel"]);
    expect(availableActions("completed")).toEqual(["reopen"]);
    expect(availableActions("cancelled")).toEqual([]);
  });

  it("only ever moves to a real status", () => {
    for (const status of ALL) for (const action of availableActions(status)) expect(ALL).toContain(nextStatus(status, action));
  });
});

describe("technician actions", () => {
  const now = new Date("2026-11-20T10:00:00Z");
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  it("offers done / no-show once the appointment has started, never cancel", () => {
    expect(staffActions("confirmed", minutesAgo(5), now)).toEqual(["complete", "no_show"]);
    expect(staffActions("confirmed", now, now)).toEqual(["complete", "no_show"]);
  });

  it("offers nothing before the start time", () => {
    expect(staffActions("confirmed", minutesAgo(-1), now)).toEqual([]);
  });

  it("lets a technician undo a mark within the edit window", () => {
    expect(staffActions("completed", minutesAgo(60), now)).toEqual(["reopen"]);
    expect(staffActions("no_show", minutesAgo(60), now)).toEqual(["reopen"]);
  });

  it("locks bookings older than the edit window", () => {
    expect(staffActions("confirmed", minutesAgo(STAFF_EDIT_DAYS * 24 * 60 + 1), now)).toEqual([]);
    expect(staffActions("confirmed", minutesAgo(STAFF_EDIT_DAYS * 24 * 60), now)).toEqual(["complete", "no_show"]);
  });

  it("offers nothing for holds, cancelled or expired bookings", () => {
    for (const s of ["pending", "cancelled", "expired"] as const) expect(staffActions(s, minutesAgo(5), now)).toEqual([]);
  });
});
