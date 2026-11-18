import { describe, expect, it } from "vitest";
import { isFinalRefundStatus, nextRefundStatus } from "@/lib/refund-status";

describe("refund status transitions", () => {
  it("moves forward in any order Razorpay reports", () => {
    expect(nextRefundStatus("creating", "pending")).toBe("pending");
    expect(nextRefundStatus("creating", "processed")).toBe("processed");
    expect(nextRefundStatus("pending", "processed")).toBe("processed");
    expect(nextRefundStatus("creating", "failed")).toBe("failed");
    expect(nextRefundStatus("pending", "failed")).toBe("failed");
  });

  it("ignores repeats and late, older events", () => {
    expect(nextRefundStatus("pending", "pending")).toBeNull();
    expect(nextRefundStatus("processed", "pending")).toBeNull();
  });

  it("never changes a final refund (a processed refund can't fail afterwards)", () => {
    for (const incoming of ["pending", "processed", "failed"] as const) {
      expect(nextRefundStatus("processed", incoming)).toBeNull();
      expect(nextRefundStatus("failed", incoming)).toBeNull();
    }
    expect(isFinalRefundStatus("processed")).toBe(true);
    expect(isFinalRefundStatus("failed")).toBe(true);
    expect(isFinalRefundStatus("pending")).toBe(false);
  });
});
