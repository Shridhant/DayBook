import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOrder,
  fetchPayment,
  RazorpayApiError,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "@/lib/razorpay";

// Vectors computed independently with Python's hmac module (not with the code under test).
const CHECKOUT_SIG = "4b4ec79cbb40e8c1d4e6671ac19ee801ac060c3a334af83b0732f87a15286fa9";
const WEBHOOK_BODY = '{"event":"payment.captured","payload":{}}';
const WEBHOOK_SIG = "5b591f4383ec8fbe1b961083c4e380ba3a920d21031e7a344c0033a356062ddb";
const BASIC_AUTH = "Basic cnpwX3Rlc3RfZHVtbXkxMjM6dGVzdF9rZXlfc2VjcmV0XzEyMw==";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("checkout signature", () => {
  const ids = { orderId: "order_TestOrder123", paymentId: "pay_TestPay456" };

  it("accepts Razorpay's HMAC of order_id|payment_id", () => {
    expect(verifyCheckoutSignature({ ...ids, signature: CHECKOUT_SIG })).toBe(true);
  });

  it("rejects tampered ids, wrong secrets and malformed signatures", () => {
    expect(verifyCheckoutSignature({ ...ids, paymentId: "pay_Other", signature: CHECKOUT_SIG })).toBe(false);
    expect(verifyCheckoutSignature({ ...ids, signature: CHECKOUT_SIG }, "another_secret")).toBe(false);
    expect(verifyCheckoutSignature({ ...ids, signature: CHECKOUT_SIG.slice(0, 63) })).toBe(false);
    expect(verifyCheckoutSignature({ ...ids, signature: "zz".repeat(32) })).toBe(false);
    expect(verifyCheckoutSignature({ ...ids, signature: "" })).toBe(false);
  });
});

describe("webhook signature", () => {
  it("accepts the HMAC of the exact raw body", () => {
    expect(verifyWebhookSignature(WEBHOOK_BODY, WEBHOOK_SIG, "test_webhook_secret_123")).toBe(true);
  });

  it("rejects a re-serialised or tampered body", () => {
    const reformatted = JSON.stringify(JSON.parse(WEBHOOK_BODY), null, 2);
    expect(verifyWebhookSignature(reformatted, WEBHOOK_SIG, "test_webhook_secret_123")).toBe(false);
    expect(verifyWebhookSignature(WEBHOOK_BODY.replace("captured", "failed"), WEBHOOK_SIG, "test_webhook_secret_123")).toBe(false);
    expect(verifyWebhookSignature(WEBHOOK_BODY, WEBHOOK_SIG, "wrong_secret_123")).toBe(false);
  });
});

describe("API client", () => {
  it("creates an INR order with basic auth and a truncated receipt", async () => {
    const fetchMock = stubFetch(200, { id: "order_Abc", amount: 50000, currency: "INR", status: "created", receipt: "DB-ABC123" });
    const order = await createOrder({ amountPaise: 50000, receipt: "DB-ABC123".padEnd(50, "x"), notes: { booking_code: "DB-ABC123" } });

    expect(order.id).toBe("order_Abc");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(BASIC_AUTH);
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({ amount: 50000, currency: "INR", receipt: "DB-ABC123".padEnd(40, "x"), notes: { booking_code: "DB-ABC123" } });
  });

  it("turns API errors into RazorpayApiError with Razorpay's description", async () => {
    stubFetch(400, { error: { code: "BAD_REQUEST_ERROR", description: "The amount must be at least INR 1.00" } });
    await expect(createOrder({ amountPaise: 50, receipt: "x" })).rejects.toMatchObject({
      status: 400,
      description: "The amount must be at least INR 1.00",
    });
    await expect(createOrder({ amountPaise: 50, receipt: "x" })).rejects.toBeInstanceOf(RazorpayApiError);
  });

  it("validates the response shape", async () => {
    stubFetch(200, { id: "pay_1", order_id: "order_1", amount: 50000, currency: "INR", status: "captured" });
    await expect(fetchPayment("pay_1")).resolves.toMatchObject({ status: "captured" });

    stubFetch(200, { id: "not-a-payment", amount: "50000" });
    await expect(fetchPayment("pay_1")).rejects.toThrow();
  });
});
