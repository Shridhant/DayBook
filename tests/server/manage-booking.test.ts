import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { sql } from "@/lib/db";
import { addDays, fromIst, istToday, timeToMinutes, weekdayOf } from "@/lib/time";
import { cancelByCustomer, getManagedBooking, ManageError, rescheduleByCustomer, rescheduleOptions } from "@/server/manage-booking";
import { isValidManageKey, manageKey, managePath } from "@/server/manage-link";
import { cleanupBookingEvents, testSql } from "../helpers/test-db";

/**
 * Customer "manage booking" link against the TEST database (day +19, unused elsewhere), with
 * Razorpay's refund API stubbed. Bookings are inserted directly as paid online bookings.
 */

const DATE = addDays(istToday(), 19);
const WEEKDAY = weekdayOf(DATE);
const tag = `mb${Date.now().toString(36)}`;
const ids: Record<string, string> = {};
let seq = 0;
const at = (time: string, date = DATE) => fromIst(date, timeToMinutes(time));

beforeAll(async () => {
  await testSql`insert into opening_hours (weekday, opens_at, closes_at) values (${WEEKDAY}, '11:00', '20:00')
                on conflict (weekday) do update set opens_at = '11:00', closes_at = '20:00'`;
  const [cat] = await testSql`insert into service_categories (name, slug) values ('MB', ${`${tag}-cat`}) returning id`;
  const [gel] = await testSql`insert into services (category_id, name, slug, price_paise, duration_min)
                              values (${cat.id}, 'Gel', ${`${tag}-gel`}, 120000, 60) returning id`;
  const [a] = await testSql`insert into staff (name, slug, sort_order) values ('Meera MB', ${`${tag}-a`}, 1) returning id`;
  const [b] = await testSql`insert into staff (name, slug, sort_order) values ('Riya MB', ${`${tag}-b`}, 2) returning id`;
  const [c] = await testSql`insert into customers (name, phone, email) values ('Manager', '8100000009', 'manager@mail.daybook-tests.in') returning id`;
  for (const s of [a.id, b.id]) {
    await testSql`insert into staff_services (staff_id, service_id) values (${s}, ${gel.id})`;
    await testSql`insert into staff_shifts (staff_id, weekday, starts_at, ends_at) values (${s}, ${WEEKDAY}, '11:00', '20:00')`;
  }
  Object.assign(ids, { cat: cat.id, gel: gel.id, a: a.id, b: b.id, customer: c.id });
});

afterEach(() => vi.unstubAllGlobals());

afterAll(async () => {
  const booked = await testSql<{ id: string }[]>`select id from bookings where customer_id = ${ids.customer}`;
  const bookingIds = booked.map((r) => r.id);
  await cleanupBookingEvents(bookingIds);
  if (bookingIds.length) {
    await testSql`delete from refunds where booking_id in ${testSql(bookingIds)}`;
    await testSql`delete from payments where booking_id in ${testSql(bookingIds)}`;
  }
  await testSql`delete from bookings where customer_id = ${ids.customer}`;
  await testSql`delete from customers where id = ${ids.customer}`;
  await testSql`delete from staff where slug like ${`${tag}%`}`;
  await testSql`delete from services where category_id = ${ids.cat}`;
  await testSql`delete from service_categories where id = ${ids.cat}`;
  await testSql`delete from opening_hours where weekday = ${WEEKDAY}`;
  await Promise.all([testSql.end(), sql.end()]);
});

/** A confirmed online booking with Meera, ₹500 paid. Returns code + key for the link. */
async function booking(opts: { from?: string; date?: string; staffId?: string; paid?: boolean; rescheduleCount?: number } = {}) {
  const n = ++seq;
  const date = opts.date ?? DATE;
  const from = opts.from ?? "12:00";
  const [b] = await testSql<{ id: string; code: string }[]>`
    insert into bookings (code, customer_id, staff_id, starts_at, ends_at, status, source, total_paise, amount_due_now_paise, reschedule_count)
    values (${`DB-M${String(n).padStart(5, "0")}`}, ${ids.customer}, ${opts.staffId ?? ids.a},
            ${at(from, date)}, ${new Date(at(from, date).getTime() + 3_600_000)}, 'confirmed', 'online', 120000, 50000, ${opts.rescheduleCount ?? 0})
    returning id, code`;
  await testSql`insert into booking_items (booking_id, service_id, name_snapshot, price_snapshot_paise, duration_snapshot_min)
                values (${b.id}, ${ids.gel}, 'Gel', 120000, 60)`;
  if (opts.paid !== false) {
    await testSql`insert into payments (booking_id, rzp_order_id, rzp_payment_id, amount_paise, status)
                  values (${b.id}, ${`order_${tag}${n}`}, ${`pay_${tag}${n}`}, 50000, 'captured')`;
  }
  return { id: b.id, code: b.code, key: manageKey(b.id) };
}

function stubRefundAccepted() {
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { amount: number; notes: { refund_id: string } };
    return Response.json({ id: `rfnd_${tag}${++seq}`, payment_id: `pay_${tag}x`, amount: body.amount, currency: "INR", status: "pending", notes: body.notes });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const codeOf = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => (e instanceof ManageError ? e.code : String(e)));

describe("manage links", () => {
  it("are stable per booking, and wrong or tampered keys don't open anything", async () => {
    const b = await booking({ from: "11:00" });
    expect(manageKey(b.id)).toBe(b.key);
    expect(managePath(b.code, b.id)).toBe(`/booking/${b.code}?k=${b.key}`);
    expect(isValidManageKey(b.id, b.key)).toBe(true);
    expect(isValidManageKey(b.id, `${b.key.slice(0, -1)}${b.key.endsWith("A") ? "B" : "A"}`)).toBe(false);
    expect(isValidManageKey(b.id, "short")).toBe(false);
    expect(await getManagedBooking(b.code, manageKey(ids.customer))).toBeNull(); // a valid key for something else
    expect(await getManagedBooking(b.code, b.key)).toMatchObject({ code: b.code, paidPaise: 50000, actions: { cancel: true, reschedule: true } });
  });
});

describe("customer cancels", () => {
  it("in time: cancels and refunds automatically", async () => {
    const b = await booking({ from: "13:00" });
    const fetchMock = stubRefundAccepted();
    const result = await cancelByCustomer(b.code, b.key);
    expect(result.refund).toEqual({ status: "started", amountPaise: 50000 });
    expect(result.booking).toMatchObject({ status: "cancelled", paidPaise: 0, refundedPaise: 50000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [refund] = await testSql`select source, created_by from refunds where booking_id = ${b.id}`;
    expect(refund).toMatchObject({ source: "auto", created_by: null });
    const [note] = await testSql`select body from notifications where booking_id = ${b.id} and type = 'booking_cancelled'`;
    expect(note.body).toContain("cancelled by the customer");
    expect(note.body).toContain("refunded automatically");
  });

  it("late: cancels but keeps the booking amount", async () => {
    const soon = new Date(Date.now() + 2 * 3_600_000);
    const b = await booking({ date: istToday(), from: "00:00" });
    await testSql`update bookings set starts_at = ${soon}, ends_at = ${new Date(soon.getTime() + 3_600_000)} where id = ${b.id}`;
    const fetchMock = stubRefundAccepted();
    const result = await cancelByCustomer(b.code, b.key);
    expect(result.refund).toEqual({ status: "not_refundable", amountPaise: 50000 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.booking).toMatchObject({ status: "cancelled", paidPaise: 50000 });
  });

  it("can't cancel twice or with a wrong key", async () => {
    const b = await booking({ from: "14:00", paid: false });
    await cancelByCustomer(b.code, b.key);
    expect(await codeOf(cancelByCustomer(b.code, b.key))).toBe("not_allowed");
    expect(await codeOf(cancelByCustomer(b.code, manageKey(ids.a)))).toBe("not_found");
  });

  it("stays cancelled and tells the customer the studio will refund if Razorpay rejects", async () => {
    const b = await booking({ from: "15:00" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { description: "Insufficient balance" } }, { status: 400 })));
    const result = await cancelByCustomer(b.code, b.key);
    expect(result.refund).toEqual({ status: "pending_owner", amountPaise: 50000 });
    expect(result.booking.status).toBe("cancelled");
  });
});

describe("customer reschedules", () => {
  it("offers times around their own booking and moves it with the same artist", async () => {
    const b = await booking({ from: "16:00" });
    const options = await rescheduleOptions(b.code, b.key, DATE, false);
    // Their own 4–5 pm doesn't block 4:30 pm, which overlaps it.
    expect(options.slots.map((s) => s.minutes)).toContain(16 * 60 + 30);

    const moved = await rescheduleByCustomer(b.code, b.key, { date: DATE, startMinutes: 16 * 60 + 30, anyArtist: false });
    expect(moved).toMatchObject({ staff: { id: ids.a }, rescheduleCount: 1 });
    expect(new Date(moved.startsAt)).toEqual(at("16:30"));
    expect(new Date(moved.endsAt)).toEqual(at("17:30"));

    const [note] = await testSql`select body from notifications where booking_id = ${b.id} and type = 'booking_rescheduled'`;
    expect(note.body).toContain("→");
    const [email] = await testSql`select ics from email_outbox where dedupe_key = ${`customer_rescheduled:${b.id}:1`}`;
    expect(email.ics).toContain("SEQUENCE:1");
  });

  it("uses another artist only when the customer allows it", async () => {
    // Meera is busy 18:00–19:00 with someone else; Riya is free.
    await booking({ from: "18:00", paid: false });
    const b = await booking({ from: "11:00", date: addDays(DATE, 7), staffId: ids.a, paid: false });
    expect(await codeOf(rescheduleByCustomer(b.code, b.key, { date: DATE, startMinutes: 18 * 60, anyArtist: false }))).toBe("slot_unavailable");
    const moved = await rescheduleByCustomer(b.code, b.key, { date: DATE, startMinutes: 18 * 60, anyArtist: true });
    expect(moved.staff.id).toBe(ids.b);
  });

  it("refuses after the limit and inside the cancel window", async () => {
    const used = await booking({ from: "19:00", rescheduleCount: 2, paid: false });
    expect(await codeOf(rescheduleByCustomer(used.code, used.key, { date: DATE, startMinutes: 11 * 60, anyArtist: true }))).toBe("not_allowed");

    const soon = new Date(Date.now() + 3_600_000);
    const late = await booking({ date: istToday(), from: "00:00", paid: false });
    await testSql`update bookings set starts_at = ${soon}, ends_at = ${new Date(soon.getTime() + 3_600_000)} where id = ${late.id}`;
    expect(await codeOf(rescheduleOptions(late.code, late.key, DATE, true))).toBe("not_allowed");
  });

  it("refuses a time that's no longer free", async () => {
    const b = await booking({ from: "11:00", date: addDays(DATE, 7), paid: false });
    // Fill 12:00 for both artists after the customer looked.
    await booking({ from: "12:00", staffId: ids.a, paid: false });
    await booking({ from: "12:00", staffId: ids.b, paid: false });
    expect(await codeOf(rescheduleByCustomer(b.code, b.key, { date: DATE, startMinutes: 12 * 60, anyArtist: true }))).toBe("slot_unavailable");
  });
});
