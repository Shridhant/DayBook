import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { addDays, istToday, timeToMinutes, weekdayOf } from "@/lib/time";
import { createHold, generateBookingCode, HoldError, type HoldRequest } from "@/server/holds";
import { testSql } from "../helpers/test-db";

/**
 * Integration tests for slot holds against the TEST database.
 * Uses today+4 so its opening_hours row never collides with other test files (they use other days).
 */

const DATE = addDays(istToday(), 4);
const WEEKDAY = weekdayOf(DATE);
const tag = `hd${Date.now().toString(36)}`;
const ids: Record<string, string> = {};
const PHONES = Array.from({ length: 40 }, (_, i) => `81000000${String(i).padStart(2, "0")}`);
let phoneIndex = 0;
function nextPhone() {
  const phone = PHONES[phoneIndex++];
  if (!phone) throw new Error("Out of test phone numbers; raise PHONES length");
  return phone;
}

beforeAll(async () => {
  await testSql`insert into opening_hours (weekday, opens_at, closes_at) values (${WEEKDAY}, '11:00', '20:00')
                on conflict (weekday) do update set opens_at = '11:00', closes_at = '20:00'`;
  const [cat] = await testSql`insert into service_categories (name, slug) values ('HD', ${`${tag}-cat`}) returning id`;
  const [gel] = await testSql`insert into services (category_id, name, slug, price_paise, duration_min)
                              values (${cat.id}, 'Gel manicure', ${`${tag}-gel`}, 123400, 60) returning id`;
  const [ext] = await testSql`insert into services (category_id, name, slug, price_paise, duration_min, booking_amount_override_paise)
                              values (${cat.id}, 'Extensions', ${`${tag}-ext`}, 250000, 120, 100000) returning id`;
  const [a] = await testSql`insert into staff (name, slug, sort_order) values ('Hold A', ${`${tag}-a`}, 1) returning id`;
  const [b] = await testSql`insert into staff (name, slug, sort_order) values ('Hold B', ${`${tag}-b`}, 2) returning id`;
  Object.assign(ids, { cat: cat.id, gel: gel.id, ext: ext.id, a: a.id, b: b.id });

  // Both do gel; only A does extensions.
  await testSql`insert into staff_services (staff_id, service_id) values (${a.id}, ${gel.id}), (${b.id}, ${gel.id}), (${a.id}, ${ext.id})`;
  for (const s of [a.id, b.id]) {
    await testSql`insert into staff_shifts (staff_id, weekday, starts_at, ends_at) values (${s}, ${WEEKDAY}, '11:00', '20:00')`;
  }
});

afterAll(async () => {
  await testSql`update settings set booking_amount_type = 'fixed', booking_amount_fixed_paise = 50000, booking_amount_percent = 20`;
  await testSql`delete from bookings where customer_id in (select id from customers where phone in ${testSql(PHONES)})`;
  await testSql`delete from customers where phone in ${testSql(PHONES)}`;
  await testSql`delete from staff where id in ${testSql([ids.a, ids.b])}`;
  await testSql`delete from services where category_id = ${ids.cat}`;
  await testSql`delete from service_categories where id = ${ids.cat}`;
  await testSql`delete from opening_hours where weekday = ${WEEKDAY}`;
  await Promise.all([testSql.end(), sql.end()]);
});

function request(time: string, overrides: Partial<HoldRequest> = {}): HoldRequest {
  return {
    serviceIds: [ids.gel],
    date: DATE,
    startMinutes: timeToMinutes(time),
    ...overrides,
    customer: overrides.customer ?? { name: "Test Customer", phone: nextPhone() },
  };
}

async function statusOf(bookingId: string) {
  const [row] = await testSql<{ status: string }[]>`select status from bookings where id = ${bookingId}`;
  return row?.status;
}

describe("createHold", () => {
  it("creates a pending booking with snapshotted items, amount and expiry", async () => {
    const before = Date.now();
    const hold = await createHold(request("11:00", { notes: "Pastel pink please" }));

    expect(hold.code).toMatch(/^DB-[2-9A-HJ-NP-Z]{6}$/);
    expect(hold.totalPaise).toBe(123400);
    expect(hold.amountDueNowPaise).toBe(50000); // default fixed ₹500
    expect(hold.endsAt.getTime() - hold.startsAt.getTime()).toBe(60 * 60_000);
    const holdMinutes = (hold.holdExpiresAt.getTime() - before) / 60_000;
    expect(holdMinutes).toBeGreaterThan(14.5);
    expect(holdMinutes).toBeLessThan(15.5);

    const [row] = await testSql`select status, source, notes, amount_due_now_paise from bookings where id = ${hold.bookingId}`;
    expect(row).toMatchObject({ status: "pending", source: "online", notes: "Pastel pink please", amount_due_now_paise: 50000 });
    const items = await testSql`select name_snapshot, price_snapshot_paise, duration_snapshot_min from booking_items
                                where booking_id = ${hold.bookingId}`;
    expect(items).toEqual([{ name_snapshot: "Gel manicure", price_snapshot_paise: 123400, duration_snapshot_min: 60 }]);
  });

  it("sends each booking's emails to the address typed for it, without changing the customer's saved email", async () => {
    const phone = nextPhone();
    const first = await createHold(request("12:00", { customer: { name: "Repeat", phone, email: "first@mail.daybook-tests.in" } }));
    // Same phone later, a different email: this booking uses it; the customer record keeps the first.
    const second = await createHold(request("13:00", { customer: { name: "Repeat", phone, email: "second@mail.daybook-tests.in" } }));
    const third = await createHold(request("14:00", { customer: { name: "Repeat", phone } }));

    const rows = await testSql<{ id: string; customer_email: string | null; saved: string | null }[]>`
      select b.id, b.customer_email, c.email as saved from bookings b join customers c on c.id = b.customer_id
      where b.id in ${testSql([first.bookingId, second.bookingId, third.bookingId])}`;
    const emailOf = (id: string) => rows.find((r) => r.id === id)?.customer_email;
    expect(emailOf(first.bookingId)).toBe("first@mail.daybook-tests.in");
    expect(emailOf(second.bookingId)).toBe("second@mail.daybook-tests.in");
    expect(emailOf(third.bookingId)).toBeNull(); // no email given: nothing is sent to an older address
    expect(new Set(rows.map((r) => r.saved))).toEqual(new Set(["first@mail.daybook-tests.in"]));
    // Free the slot for the tests below (only the latest hold is still live).
    await testSql`update bookings set status = 'expired' where id = ${third.bookingId}`;
  });

  it("uses a service's booking-amount override", async () => {
    const hold = await createHold(request("18:00", { serviceIds: [ids.ext] })); // 18:00–20:00, A is free
    expect(hold.amountDueNowPaise).toBe(100000);
    expect(hold.staff.id).toBe(ids.a); // only A does extensions
  });

  it("rounds a percentage booking amount to the nearest ₹10", async () => {
    await testSql`update settings set booking_amount_type = 'percent', booking_amount_percent = 20`;
    try {
      const hold = await createHold(request("12:00"));
      expect(hold.amountDueNowPaise).toBe(25000); // 20% of ₹1,234 = ₹246.80 → ₹250
    } finally {
      await testSql`update settings set booking_amount_type = 'fixed'`;
    }
  });

  it("gives 'Any available' customers the next free technician", async () => {
    const first = await createHold(request("13:00"));
    const second = await createHold(request("13:00"));
    expect(new Set([first.staff.id, second.staff.id])).toEqual(new Set([ids.a, ids.b]));
    // Both technicians are now held at 13:00.
    await expect(createHold(request("13:00"))).rejects.toMatchObject({ code: "slot_unavailable" });
  });

  it("refuses a slot held for a chosen technician", async () => {
    await createHold(request("14:00", { staffId: ids.b }));
    await expect(createHold(request("14:00", { staffId: ids.b }))).rejects.toBeInstanceOf(HoldError);
  });

  it("releases a customer's previous hold when they pick another time", async () => {
    const phone = nextPhone();
    const first = await createHold(request("15:00", { staffId: ids.b, customer: { name: "Mover", phone } }));
    const second = await createHold(request("15:30", { staffId: ids.b, customer: { name: "Mover", phone } }));
    expect(await statusOf(first.bookingId)).toBe("expired");
    expect(await statusOf(second.bookingId)).toBe("pending");
  });

  it("expires lapsed holds so their slot can be taken", async () => {
    const stale = await createHold(request("16:00", { staffId: ids.a }));
    await testSql`update bookings set hold_expires_at = now() - interval '1 minute' where id = ${stale.bookingId}`;
    const fresh = await createHold(request("16:00", { staffId: ids.a }));
    expect(fresh.staff.id).toBe(ids.a);
    expect(await statusOf(stale.bookingId)).toBe("expired");
  });

  it("rejects a start time that isn't an offered slot", async () => {
    await expect(createHold(request("11:05"))).rejects.toMatchObject({ code: "slot_unavailable" });
    await expect(createHold(request("19:30"))).rejects.toMatchObject({ code: "slot_unavailable" }); // would end after close
  });

  it("lets exactly one of two simultaneous requests win the last slot", async () => {
    const results = await Promise.allSettled([
      createHold(request("17:00", { staffId: ids.a })),
      createHold(request("17:00", { staffId: ids.a })),
    ]);
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0].reason).toBeInstanceOf(HoldError);

    const [{ count }] = await testSql<{ count: number }[]>`
      select count(*)::int as count from bookings
      where staff_id = ${ids.a} and status = 'pending' and starts_at = ${`${DATE} 17:00+05:30`}`;
    expect(count).toBe(1);
  });
});

describe("generateBookingCode", () => {
  it("uses only unambiguous characters", () => {
    for (let i = 0; i < 200; i++) expect(generateBookingCode()).toMatch(/^DB-[2-9A-HJ-NP-Z]{6}$/);
  });
});
