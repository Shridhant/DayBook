import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as verifyRoute } from "@/app/api/payments/verify/route";
import { POST as webhookRoute } from "@/app/api/webhooks/razorpay/route";
import { sql } from "@/lib/db";
import type { RazorpayPayment } from "@/lib/razorpay";
import { addDays, istToday } from "@/lib/time";
import { PaymentError, recordPayment, settlePayment, startPayment } from "@/server/payments";
import { cleanupBookingEvents, testSql } from "../helpers/test-db";

/**
 * Payments against the TEST database, with Razorpay's HTTP API stubbed (no network).
 * Bookings are inserted directly; each gets its own 30-minute block so active ones never overlap.
 */

const DATE = addDays(istToday(), 5);
const tag = `pm${Date.now().toString(36)}`;
const PHONE = "8200000001";
const KEY_SECRET = "test_key_secret_123";
const WEBHOOK_SECRET = "test_webhook_secret_123";
let staffId = "";
let customerId = "";
let block = 0;
let seq = 0;

beforeAll(async () => {
  const [a] = await testSql`insert into staff (name, slug) values ('Pay A', ${`${tag}-a`}) returning id`;
  const [c] = await testSql`insert into customers (name, phone, email) values ('Payer', ${PHONE}, 'payer@mail.daybook-tests.in') returning id`;
  staffId = a.id;
  customerId = c.id;
});

afterEach(() => vi.unstubAllGlobals());

afterAll(async () => {
  const booked = await testSql<{ id: string }[]>`select id from bookings where customer_id = ${customerId}`;
  await cleanupBookingEvents(booked.map((b) => b.id));
  await testSql`delete from payments where booking_id in (select id from bookings where customer_id = ${customerId})`;
  await testSql`delete from bookings where customer_id = ${customerId}`;
  await testSql`delete from customers where id = ${customerId}`;
  await testSql`delete from staff where id = ${staffId}`;
  await testSql`delete from payment_events where rzp_event_id like ${`${tag}%`} or payload::text like ${`%${tag}%`}`;
  await Promise.all([testSql.end(), sql.end()]);
});

type BookingOptions = { status?: string; dueNow?: number; holdLive?: boolean; atBlock?: number; orderId?: string | null };

/** Inserts an online booking (and optionally its payments row). Returns ids. */
async function makeBooking(opts: BookingOptions = {}) {
  const { status = "pending", dueNow = 50000, holdLive = true, orderId = `order_${tag}${++seq}` } = opts;
  const b = opts.atBlock ?? block++;
  const starts = `${DATE} 00:00+05:30`;
  const hold = status === "pending" ? (holdLive ? "now() + interval '10 minutes'" : "now() - interval '1 minute'") : null;
  const [row] = await testSql<{ id: string; code: string }[]>`
    insert into bookings (code, customer_id, customer_email, staff_id, starts_at, ends_at, status, source, total_paise,
                          amount_due_now_paise, hold_expires_at, cancelled_at)
    values (${`DB-P${String(++seq).padStart(5, "0")}`}, ${customerId}, (select email from customers where id = ${customerId}), ${staffId},
            ${starts}::timestamptz + make_interval(mins => ${b * 30}),
            ${starts}::timestamptz + make_interval(mins => ${b * 30 + 30}),
            ${status}, 'online', 120000, ${dueNow},
            ${hold === null ? null : testSql.unsafe(hold)}, ${status === "cancelled" ? new Date() : null})
    returning id, code`;
  if (orderId) {
    await testSql`insert into payments (booking_id, rzp_order_id, amount_paise) values (${row.id}, ${orderId}, ${dueNow})`;
  }
  return { bookingId: row.id, code: row.code, orderId, block: b };
}

function payment(orderId: string | null, overrides: Partial<RazorpayPayment> = {}): RazorpayPayment {
  return { id: `pay_${tag}${++seq}`, order_id: orderId, amount: 50000, currency: "INR", status: "captured", method: "upi", ...overrides };
}

async function bookingStatus(id: string) {
  const [row] = await testSql<{ status: string; hold_expires_at: Date | null }[]>`select status, hold_expires_at from bookings where id = ${id}`;
  return row;
}
async function paymentRow(orderId: string) {
  const [row] = await testSql`select status, rzp_payment_id, needs_review from payments where rzp_order_id = ${orderId}`;
  return row;
}

/** Stubs fetch with a queue of Razorpay API responses, in call order. */
function stubRazorpay(...responses: { status?: number; body: unknown }[]) {
  const queue = [...responses];
  const fetchMock = vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error("Unexpected Razorpay call");
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/* ---------- startPayment ---------- */

describe("startPayment", () => {
  it("creates one Razorpay order for a held booking and reuses it on retry", async () => {
    const { bookingId } = await makeBooking({ orderId: null });
    const fetchMock = stubRazorpay({ body: { id: `order_${tag}new`, amount: 50000, currency: "INR", status: "created" } });

    const first = await startPayment(bookingId);
    expect(first).toMatchObject({
      kind: "order",
      orderId: `order_${tag}new`,
      amountPaise: 50000,
      keyId: "rzp_test_dummy123",
      prefill: { name: "Payer", contact: `+91${PHONE}`, email: "payer@mail.daybook-tests.in" },
    });
    const again = await startPayment(bookingId);
    expect(again).toMatchObject({ kind: "order", orderId: `order_${tag}new` });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("confirms immediately when the booking amount is ₹0", async () => {
    const { bookingId } = await makeBooking({ dueNow: 0, orderId: null });
    const fetchMock = stubRazorpay();
    expect(await startPayment(bookingId)).toMatchObject({ kind: "confirmed" });
    expect((await bookingStatus(bookingId)).status).toBe("confirmed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses expired holds and unknown bookings", async () => {
    const lapsed = await makeBooking({ holdLive: false, orderId: null });
    await expect(startPayment(lapsed.bookingId)).rejects.toMatchObject({ code: "hold_expired" });
    await expect(startPayment("01900000-0000-7000-8000-000000000000")).rejects.toBeInstanceOf(PaymentError);
  });
});

/* ---------- recordPayment ---------- */

describe("recordPayment", () => {
  it("confirms the booking on capture and is idempotent", async () => {
    const { bookingId, orderId } = await makeBooking();
    const p = payment(orderId);
    expect((await recordPayment(p)).outcome).toBe("confirmed");
    expect(await bookingStatus(bookingId)).toEqual({ status: "confirmed", hold_expires_at: null });
    expect(await paymentRow(orderId!)).toMatchObject({ status: "captured", rzp_payment_id: p.id, needs_review: false });
    expect((await recordPayment(p)).outcome).toBe("already_confirmed");
  });

  it("records a failed attempt, then confirms a later successful one on the same order", async () => {
    const { bookingId, orderId } = await makeBooking();
    expect((await recordPayment(payment(orderId, { status: "failed" }))).outcome).toBe("failed");
    expect((await paymentRow(orderId!)).status).toBe("failed");
    expect((await bookingStatus(bookingId)).status).toBe("pending");

    expect((await recordPayment(payment(orderId))).outcome).toBe("confirmed");
    // A late "failed" event for the earlier attempt must not undo the capture.
    expect((await recordPayment(payment(orderId, { status: "failed" }))).outcome).toBe("failed");
    expect((await paymentRow(orderId!)).status).toBe("captured");
    expect((await bookingStatus(bookingId)).status).toBe("confirmed");
  });

  it("waits on authorized payments", async () => {
    const { bookingId, orderId } = await makeBooking();
    expect((await recordPayment(payment(orderId, { status: "authorized" }))).outcome).toBe("processing");
    expect((await bookingStatus(bookingId)).status).toBe("pending");
  });

  it("flags an amount mismatch for review instead of confirming", async () => {
    const { bookingId, orderId } = await makeBooking();
    expect((await recordPayment(payment(orderId, { amount: 100 }))).outcome).toBe("needs_review");
    expect((await paymentRow(orderId!)).needs_review).toBe(true);
    expect((await bookingStatus(bookingId)).status).toBe("pending");
  });

  it("confirms a late payment for an expired hold if the slot is still free", async () => {
    const { bookingId, orderId } = await makeBooking({ status: "expired" });
    expect((await recordPayment(payment(orderId))).outcome).toBe("confirmed");
    expect((await bookingStatus(bookingId)).status).toBe("confirmed");
  });

  it("flags a late payment for review if someone else took the slot", async () => {
    const expired = await makeBooking({ status: "expired" });
    await makeBooking({ status: "confirmed", atBlock: expired.block, orderId: null }); // same time, same artist
    expect((await recordPayment(payment(expired.orderId))).outcome).toBe("needs_review");
    expect((await bookingStatus(expired.bookingId)).status).toBe("expired");
    expect((await paymentRow(expired.orderId!)).needs_review).toBe(true);
  });

  it("flags payment for a cancelled booking and ignores unknown orders", async () => {
    const cancelled = await makeBooking({ status: "cancelled" });
    expect((await recordPayment(payment(cancelled.orderId))).outcome).toBe("needs_review");
    expect((await recordPayment(payment(`order_${tag}nope`))).outcome).toBe("unknown_order");
    expect((await recordPayment(payment(null))).outcome).toBe("unknown_order");
  });
  it("treats a repeat of the same capture as handled, whatever happened to the booking since", async () => {
    // verify, payment.captured and order.paid all report one capture; a cancel or no-show can land in between.
    for (const later of ["cancelled", "no_show"]) {
      const { bookingId, orderId } = await makeBooking();
      const p = payment(orderId);
      expect((await recordPayment(p)).outcome).toBe("confirmed");
      await testSql`update bookings set status = ${later}, cancelled_at = ${later === "cancelled" ? new Date() : null} where id = ${bookingId}`;

      expect((await recordPayment(p)).outcome).toBe("already_confirmed");
      expect(await paymentRow(orderId!)).toMatchObject({ status: "captured", rzp_payment_id: p.id, needs_review: false });
      const alerts = await testSql`select 1 from notifications where booking_id = ${bookingId} and type = 'payment_review'`;
      expect(alerts).toHaveLength(0);
    }
  });

  it("repeats a needs-review outcome instead of reporting a flagged payment as confirmed", async () => {
    const { orderId } = await makeBooking();
    const p = payment(orderId, { amount: 100 });
    expect((await recordPayment(p)).outcome).toBe("needs_review");
    expect((await recordPayment(p)).outcome).toBe("needs_review");
  });

  it("flags a second payment on an already-paid order and keeps the first one on record", async () => {
    const { bookingId, orderId } = await makeBooking();
    const first = payment(orderId);
    expect((await recordPayment(first)).outcome).toBe("confirmed");

    expect((await recordPayment(payment(orderId))).outcome).toBe("needs_review");
    expect(await paymentRow(orderId!)).toMatchObject({ status: "captured", rzp_payment_id: first.id, needs_review: true });
    expect((await bookingStatus(bookingId)).status).toBe("confirmed");
  });
});

/* ---------- settlePayment (API fetch + capture) ---------- */

describe("settlePayment", () => {
  it("captures an authorized payment, then confirms", async () => {
    const { bookingId, orderId } = await makeBooking();
    const base = { id: `pay_${tag}cap`, order_id: orderId, amount: 50000, currency: "INR" };
    const fetchMock = stubRazorpay({ body: { ...base, status: "authorized" } }, { body: { ...base, status: "captured" } });

    expect(await settlePayment(base.id)).toMatchObject({ outcome: "confirmed", orderId });
    expect((await bookingStatus(bookingId)).status).toBe("confirmed");
    const [, captureCall] = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(captureCall[0]).toContain(`/payments/${base.id}/capture`);
  });

  it("doesn't capture a second payment on an order that's already paid", async () => {
    const { orderId } = await makeBooking();
    const first = payment(orderId);
    expect((await recordPayment(first)).outcome).toBe("confirmed");

    const second = { id: `pay_${tag}dup`, order_id: orderId, amount: 50000, currency: "INR", status: "authorized" };
    const fetchMock = stubRazorpay({ body: second });
    expect(await settlePayment(second.id)).toMatchObject({ outcome: "needs_review", orderId });
    expect(fetchMock).toHaveBeenCalledTimes(1); // the fetch only, no capture call
    expect((await paymentRow(orderId!)).rzp_payment_id).toBe(first.id);
  });
});

/* ---------- Routes ---------- */

function signedWebhook(body: object, eventId?: string) {
  const raw = JSON.stringify(body);
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
  return new Request("http://test/api/webhooks/razorpay", {
    method: "POST",
    body: raw,
    headers: { "x-razorpay-signature": signature, ...(eventId ? { "x-razorpay-event-id": eventId } : {}) },
  });
}

describe("POST /api/webhooks/razorpay", () => {
  it("confirms on payment.captured and processes each event id once", async () => {
    const { bookingId, orderId } = await makeBooking();
    const event = { event: "payment.captured", payload: { payment: { entity: payment(orderId) } } };

    const first = await webhookRoute(signedWebhook(event, `${tag}-evt-1`));
    expect(first.status).toBe(200);
    expect((await bookingStatus(bookingId)).status).toBe("confirmed");

    const again = await webhookRoute(signedWebhook(event, `${tag}-evt-1`));
    expect(again.status).toBe(200);
    const [{ count }] = await testSql<{ count: number }[]>`
      select count(*)::int as count from payment_events where rzp_event_id = ${`${tag}-evt-1`}`;
    expect(count).toBe(1);
  });

  it("rejects a bad signature without touching the database", async () => {
    const { bookingId, orderId } = await makeBooking();
    const request = signedWebhook({ event: "payment.captured", payload: { payment: { entity: payment(orderId) } } }, `${tag}-evt-bad`);
    const forged = new Request(request.url, {
      method: "POST",
      body: await request.text(),
      headers: { "x-razorpay-signature": "0".repeat(64), "x-razorpay-event-id": `${tag}-evt-bad` },
    });
    expect((await webhookRoute(forged)).status).toBe(401);
    expect((await bookingStatus(bookingId)).status).toBe("pending");
  });

  it("acknowledges events it doesn't act on", async () => {
    const response = await webhookRoute(signedWebhook({ event: "payment.dispute.created", payload: { tag } }, `${tag}-evt-other`));
    expect(response.status).toBe(200);
  });
});

describe("POST /api/payments/verify", () => {
  function verifyRequest(orderId: string, paymentId: string, signature?: string) {
    const sig = signature ?? createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    return new Request("http://test/api/payments/verify", {
      method: "POST",
      body: JSON.stringify({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig }),
    });
  }

  it("confirms after checking the signature and fetching the payment from Razorpay", async () => {
    const { bookingId, orderId, code } = await makeBooking();
    const paymentId = `pay_${tag}verify`;
    stubRazorpay({ body: { id: paymentId, order_id: orderId, amount: 50000, currency: "INR", status: "captured" } });

    const response = await verifyRoute(verifyRequest(orderId!, paymentId));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "confirmed", code });
    expect((await bookingStatus(bookingId)).status).toBe("confirmed");
  });

  it("rejects a forged signature before calling Razorpay", async () => {
    const { orderId } = await makeBooking();
    const fetchMock = stubRazorpay();
    const response = await verifyRoute(verifyRequest(orderId!, `pay_${tag}forged`, "a".repeat(64)));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a valid signature whose payment belongs to a different order", async () => {
    const { bookingId, orderId } = await makeBooking();
    const paymentId = `pay_${tag}swap`;
    stubRazorpay({ body: { id: paymentId, order_id: "order_SomeoneElse", amount: 50000, currency: "INR", status: "captured" } });
    const response = await verifyRoute(verifyRequest(orderId!, paymentId));
    expect(response.status).toBe(400);
    expect((await bookingStatus(bookingId)).status).toBe("pending");
  });
});
