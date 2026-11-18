import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as webhookRoute } from "@/app/api/webhooks/razorpay/route";
import { sql } from "@/lib/db";
import type { RazorpayRefund } from "@/lib/razorpay";
import { addDays, istToday } from "@/lib/time";
import { getAdminBooking } from "@/server/admin/bookings";
import { applyRefundState, refundBooking, RefundError } from "@/server/refunds";
import { cleanupBookingEvents, testSql } from "../helpers/test-db";

// Demo mode on, so sample payments (pay_demo…) take the in-app path; every other id here is a normal one.
vi.mock("@/lib/demo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demo")>();
  return { ...actual, DEMO_MODE: true, isSamplePayment: (id: string) => id.startsWith("pay_demo") };
});

/** Refunds against the TEST database, with Razorpay's HTTP API stubbed (no network). Day +16. */

const DATE = addDays(istToday(), 16);
const tag = `rf${Date.now().toString(36)}`;
const WEBHOOK_SECRET = "test_webhook_secret_123";
const ids: Record<string, string> = {};
let seq = 0;

beforeAll(async () => {
  const [a] = await testSql`insert into staff (name, slug) values ('Refund A', ${`${tag}-a`}) returning id`;
  const [c] = await testSql`insert into customers (name, phone, email) values ('Refundee', '8300000001', 'refundee@mail.daybook-tests.in') returning id`;
  Object.assign(ids, { staff: a.id, customer: c.id });
});

afterEach(() => vi.unstubAllGlobals());

afterAll(async () => {
  const booked = await testSql<{ id: string }[]>`select id from bookings where customer_id = ${ids.customer}`;
  const bookingIds = booked.map((b) => b.id);
  await cleanupBookingEvents(bookingIds);
  if (bookingIds.length) {
    await testSql`delete from refunds where booking_id in ${testSql(bookingIds)}`;
    await testSql`delete from payments where booking_id in ${testSql(bookingIds)}`;
  }
  await testSql`delete from bookings where customer_id = ${ids.customer}`;
  await testSql`delete from customers where id = ${ids.customer}`;
  await testSql`delete from staff where id = ${ids.staff}`;
  await testSql`delete from payment_events where rzp_event_id like ${`${tag}%`}`;
  await Promise.all([testSql.end(), sql.end()]);
});

/** A cancelled online booking with a captured ₹500 payment. */
async function paidBooking(opts: { status?: string; needsReview?: boolean; paymentPrefix?: string } = {}) {
  const n = ++seq;
  const [b] = await testSql<{ id: string }[]>`
    insert into bookings (code, customer_id, customer_email, staff_id, starts_at, ends_at, status, source, total_paise, amount_due_now_paise, cancelled_at)
    values (${`DB-R${String(n).padStart(5, "0")}`}, ${ids.customer}, (select email from customers where id = ${ids.customer}), ${ids.staff},
            ${`${DATE} 00:00+05:30`}::timestamptz + make_interval(mins => ${n * 30}),
            ${`${DATE} 00:00+05:30`}::timestamptz + make_interval(mins => ${n * 30 + 30}),
            ${opts.status ?? "cancelled"}, 'online', 120000, 50000, ${(opts.status ?? "cancelled") === "cancelled" ? new Date() : null})
    returning id`;
  const paymentId = `${opts.paymentPrefix ?? "pay_"}${tag}${n}`;
  await testSql`
    insert into payments (booking_id, rzp_order_id, rzp_payment_id, amount_paise, status, needs_review)
    values (${b.id}, ${`order_${tag}${n}`}, ${paymentId}, 50000, 'captured', ${opts.needsReview ?? false})`;
  return { bookingId: b.id, paymentId };
}

function rzpRefund(paymentId: string, amount: number, status: RazorpayRefund["status"], refundId?: string | null, id = `rfnd_${tag}${++seq}`) {
  return { id, entity: "refund", payment_id: paymentId, amount, currency: "INR", status, notes: refundId ? { refund_id: refundId } : [] };
}

/** Razorpay answers each refund call with an accepted refund echoing the requested amount/notes. */
function stubAccepting(status: RazorpayRefund["status"] = "pending") {
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { amount: number; notes: { refund_id: string } };
    const paymentId = /payments\/([^/]+)\/refund/.exec(url)?.[1] ?? "";
    return new Response(JSON.stringify(rzpRefund(paymentId, body.amount, status, body.notes.refund_id)));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function paymentState(paymentId: string) {
  const [row] = await testSql<{ refunded_paise: number; needs_review: boolean }[]>`
    select refunded_paise, needs_review from payments where rzp_payment_id = ${paymentId}`;
  return row;
}

async function refundsOf(bookingId: string) {
  return testSql<{ id: string; status: string; amount_paise: number; source: string; rzp_refund_id: string | null }[]>`
    select id, status, amount_paise, source, rzp_refund_id from refunds where booking_id = ${bookingId} order by created_at`;
}

function signedWebhook(body: object, eventId: string) {
  const raw = JSON.stringify(body);
  return new Request("http://test/api/webhooks/razorpay", {
    method: "POST",
    body: raw,
    headers: { "x-razorpay-signature": createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex"), "x-razorpay-event-id": eventId },
  });
}

describe("refundBooking", () => {
  it("refunds everything by default, clears the refund-due flag and emails the customer", async () => {
    const { bookingId, paymentId } = await paidBooking({ needsReview: true });
    const fetchMock = stubAccepting();

    expect(await refundBooking({ bookingId, userId: null, source: "admin", reason: "Salon closed" })).toEqual({ amountPaise: 50000, status: "pending" });

    const [call] = fetchMock.mock.calls;
    expect(call[0]).toContain(`/payments/${paymentId}/refund`);
    expect(JSON.parse(String(call[1].body))).toMatchObject({ amount: 50000, speed: "normal" });
    expect(await paymentState(paymentId)).toEqual({ refunded_paise: 50000, needs_review: false });
    const [refund] = await refundsOf(bookingId);
    expect(refund).toMatchObject({ status: "pending", amount_paise: 50000 });
    expect(refund.rzp_refund_id).toMatch(/^rfnd_/);

    const booking = await getAdminBooking(bookingId);
    expect(booking).toMatchObject({ paidPaise: 0, refundDue: false });
    expect(booking?.refunds).toHaveLength(1);
    const emails = await testSql`select subject from email_outbox where dedupe_key = ${`customer_refund:${bookingId}:${refund.id}`}`;
    expect(emails[0].subject).toContain("Refund of ₹500");
  });

  it("supports partial refunds and never refunds more than was paid", async () => {
    const { bookingId, paymentId } = await paidBooking({ status: "confirmed" });
    stubAccepting();
    await refundBooking({ bookingId, amountPaise: 20000, userId: null, source: "admin" });
    await expect(refundBooking({ bookingId, amountPaise: 30001, userId: null, source: "admin" })).rejects.toMatchObject({ code: "too_much" });
    expect((await refundBooking({ bookingId, userId: null, source: "admin" })).amountPaise).toBe(30000);
    expect((await paymentState(paymentId)).refunded_paise).toBe(50000);
    await expect(refundBooking({ bookingId, userId: null, source: "admin" })).rejects.toMatchObject({ code: "nothing_to_refund" });
  });

  it("can't refund twice when two requests race", async () => {
    const { bookingId, paymentId } = await paidBooking();
    const fetchMock = stubAccepting();
    const results = await Promise.allSettled([
      refundBooking({ bookingId, userId: null, source: "admin" }),
      refundBooking({ bookingId, userId: null, source: "admin" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "nothing_to_refund" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await paymentState(paymentId)).refunded_paise).toBe(50000);
  });

  it("releases the amount and alerts the owner when Razorpay rejects the refund", async () => {
    const { bookingId, paymentId } = await paidBooking();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { description: "Insufficient balance" } }, { status: 400 })));

    const error = await refundBooking({ bookingId, userId: null, source: "admin" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RefundError);
    expect(error).toMatchObject({ code: "rejected", message: expect.stringContaining("Insufficient balance") });
    expect(await paymentState(paymentId)).toEqual({ refunded_paise: 0, needs_review: true });
    expect((await refundsOf(bookingId))[0].status).toBe("failed");
    const [note] = await testSql`select type from notifications where booking_id = ${bookingId} and type = 'refund_failed'`;
    expect(note).toBeTruthy();
    expect((await getAdminBooking(bookingId))?.refundDue).toBe(true);
  });

  it("keeps a refund open when Razorpay doesn't answer, and the webhook completes it", async () => {
    const { bookingId, paymentId } = await paidBooking();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("timed out", "TimeoutError"); }));

    expect(await refundBooking({ bookingId, userId: null, source: "admin" })).toEqual({ amountPaise: 50000, status: "creating" });
    const [open] = await refundsOf(bookingId);
    expect(open.status).toBe("creating");
    expect((await paymentState(paymentId)).refunded_paise).toBe(50000); // reserved: can't be refunded again meanwhile

    const event = { event: "refund.processed", payload: { refund: { entity: rzpRefund(paymentId, 50000, "processed", open.id) } } };
    expect((await webhookRoute(signedWebhook(event, `${tag}-evt-${seq}`))).status).toBe(200);
    expect((await refundsOf(bookingId))[0]).toMatchObject({ id: open.id, status: "processed" });
    expect(await testSql`select 1 from email_outbox where dedupe_key = ${`customer_refund:${bookingId}:${open.id}`}`).toHaveLength(1);
  });

  it("refuses unknown bookings", async () => {
    stubAccepting();
    await expect(refundBooking({ bookingId: "01900000-0000-7000-8000-000000000000", userId: null, source: "admin" })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("refund webhooks", () => {
  it("only moves a refund forward, whatever order events arrive in", async () => {
    const { bookingId, paymentId } = await paidBooking();
    stubAccepting();
    await refundBooking({ bookingId, userId: null, source: "admin" });
    const [refund] = await refundsOf(bookingId);
    const rzpId = refund.rzp_refund_id ?? "";

    await applyRefundState(rzpRefund(paymentId, 50000, "processed", null, rzpId));
    await applyRefundState(rzpRefund(paymentId, 50000, "pending", null, rzpId)); // late refund.created
    await applyRefundState(rzpRefund(paymentId, 50000, "failed", null, rzpId)); // can't fail once processed
    expect((await refundsOf(bookingId))[0].status).toBe("processed");
    expect((await paymentState(paymentId)).refunded_paise).toBe(50000);
  });

  it("marks a pending refund failed and makes the money refundable again", async () => {
    const { bookingId, paymentId } = await paidBooking();
    stubAccepting();
    await refundBooking({ bookingId, userId: null, source: "admin" });
    const [refund] = await refundsOf(bookingId);
    await applyRefundState(rzpRefund(paymentId, 50000, "failed", null, refund.rzp_refund_id ?? ""));
    expect((await refundsOf(bookingId))[0].status).toBe("failed");
    expect(await paymentState(paymentId)).toEqual({ refunded_paise: 0, needs_review: true });
  });

  it("records refunds made in the Razorpay dashboard exactly once", async () => {
    const { bookingId, paymentId } = await paidBooking();
    const entity = rzpRefund(paymentId, 10000, "processed");
    const event = (n: number) => signedWebhook({ event: "refund.processed", payload: { refund: { entity } } }, `${tag}-dash-${n}`);
    await webhookRoute(event(1));
    await webhookRoute(event(2)); // a second delivery with a different event id
    const rows = await refundsOf(bookingId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "dashboard", amount_paise: 10000, status: "processed" });
    expect((await paymentState(paymentId)).refunded_paise).toBe(10000);
  });

  it("ignores refunds for payments that aren't ours", async () => {
    await applyRefundState(rzpRefund(`pay_${tag}unknown`, 10000, "processed"));
    expect(await testSql`select 1 from refunds where raw->>'payment_id' = ${`pay_${tag}unknown`}`).toHaveLength(0);
  });
});

describe("demo sample payments", () => {
  it("refunds a sample booking inside the app, without calling Razorpay", async () => {
    const { bookingId, paymentId } = await paidBooking({ paymentPrefix: "pay_demo", needsReview: true });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await refundBooking({ bookingId, userId: null, source: "admin" });
    expect(outcome.amountPaise).toBe(50000);
    expect(fetchMock).not.toHaveBeenCalled();
    const [refund] = await refundsOf(bookingId);
    expect(refund).toMatchObject({ status: "processed", amount_paise: 50000 });
    expect(refund.rzp_refund_id).toMatch(/^rfnd_demo/);
    expect(await paymentState(paymentId)).toEqual({ refunded_paise: 50000, needs_review: false });
  });
});

