import { describe, expect, it } from "vitest";
import { isSettled, nextPaymentStatus, type PaymentStatus } from "@/lib/payment-status";

const ALL: PaymentStatus[] = ["created", "authorized", "captured", "failed", "refunded", "partially_refunded"];

describe("payment status transitions", () => {
  it("moves forward to captured from any unsettled state", () => {
    for (const from of ["created", "failed", "authorized"] as const) expect(nextPaymentStatus(from, "captured")).toBe("captured");
    expect(nextPaymentStatus("created", "authorized")).toBe("authorized");
    expect(nextPaymentStatus("failed", "authorized")).toBe("authorized");
  });

  it("records failures only before money was taken or authorized", () => {
    expect(nextPaymentStatus("created", "failed")).toBe("failed");
    expect(nextPaymentStatus("failed", "failed")).toBe("failed");
    expect(nextPaymentStatus("authorized", "failed")).toBeNull();
    expect(nextPaymentStatus("captured", "failed")).toBeNull();
  });

  it("never changes a settled payment", () => {
    for (const from of ALL.filter(isSettled)) {
      for (const incoming of ["created", "authorized", "captured", "refunded", "failed"] as const) {
        expect(nextPaymentStatus(from, incoming)).toBeNull();
      }
    }
  });

  it("never stores Razorpay's created or refunded states (orders start as created; refunds live elsewhere)", () => {
    for (const from of ALL) {
      expect(nextPaymentStatus(from, "created")).toBeNull();
      expect(nextPaymentStatus(from, "refunded")).toBeNull();
    }
  });

  it("treats captured and the refunded states as settled", () => {
    expect(ALL.filter(isSettled)).toEqual(["captured", "refunded", "partially_refunded"]);
  });
});
