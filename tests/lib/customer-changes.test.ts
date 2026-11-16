import { describe, expect, it } from "vitest";
import { customerActions, customerChangeTerms, MAX_CUSTOMER_RESCHEDULES } from "@/lib/customer-changes";

const start = new Date("2026-11-20T10:00:00Z");
const hoursBefore = (h: number) => new Date(start.getTime() - h * 3_600_000);
const base = { status: "confirmed", startsAt: start, cancelWindowHours: 24, rescheduleCount: 0, paidPaise: 50000 };

describe("customer change terms", () => {
  it("is free up to exactly the cancel window", () => {
    expect(customerChangeTerms(start, hoursBefore(24), 24)).toMatchObject({ upcoming: true, free: true });
    expect(customerChangeTerms(start, hoursBefore(23.99), 24)).toMatchObject({ upcoming: true, free: false });
    expect(customerChangeTerms(start, hoursBefore(0), 24)).toMatchObject({ upcoming: false, free: false });
  });

  it("with a 0-hour window, changes are free until the start", () => {
    expect(customerChangeTerms(start, hoursBefore(0.01), 0)).toMatchObject({ free: true });
    expect(customerChangeTerms(start, start, 0)).toMatchObject({ free: false, upcoming: false });
  });
});

describe("customer actions", () => {
  it("allows cancel with refund and reschedule outside the window", () => {
    expect(customerActions({ ...base, now: hoursBefore(48) })).toEqual({ cancel: true, reschedule: true, refundOnCancel: true });
  });

  it("allows a late cancel without refund, and no reschedule, inside the window", () => {
    expect(customerActions({ ...base, now: hoursBefore(2) })).toEqual({ cancel: true, reschedule: false, refundOnCancel: false });
  });

  it("offers nothing once the appointment started or the booking isn't confirmed", () => {
    expect(customerActions({ ...base, now: start })).toEqual({ cancel: false, reschedule: false, refundOnCancel: false });
    for (const status of ["pending", "cancelled", "completed", "no_show", "expired"]) {
      expect(customerActions({ ...base, status, now: hoursBefore(48) })).toEqual({ cancel: false, reschedule: false, refundOnCancel: false });
    }
  });

  it("limits reschedules and doesn't promise a refund when nothing was paid", () => {
    expect(customerActions({ ...base, rescheduleCount: MAX_CUSTOMER_RESCHEDULES, now: hoursBefore(48) }).reschedule).toBe(false);
    expect(customerActions({ ...base, paidPaise: 0, now: hoursBefore(48) }).refundOnCancel).toBe(false);
  });
});
