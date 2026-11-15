import { describe, expect, it } from "vitest";
import type { BookingStatus } from "@/server/availability";
import { availableActions, nextStatus } from "@/lib/booking-status";

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
