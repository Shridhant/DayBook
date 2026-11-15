import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { addDays, istToday, timeToMinutes, weekdayOf } from "@/lib/time";
import { applyBookingAction, createAdminBooking, getDaySchedule, listBookings } from "@/server/admin/bookings";
import { cleanupBookingEvents, testSql } from "../helpers/test-db";

/** Admin booking operations against the TEST database. Uses today+6 (its own weekday). */

const DATE = addDays(istToday(), 6);
const WEEKDAY = weekdayOf(DATE);
const tag = `ad${Date.now().toString(36)}`;
const ids: Record<string, string> = {};
const PHONES = ["8300000001", "8300000002", "8300000003", "8300000004"];

beforeAll(async () => {
  await testSql`insert into opening_hours (weekday, opens_at, closes_at) values (${WEEKDAY}, '11:00', '20:00')
                on conflict (weekday) do update set opens_at = '11:00', closes_at = '20:00'`;
  const [cat] = await testSql`insert into service_categories (name, slug) values ('AD', ${`${tag}-cat`}) returning id`;
  const [gel] = await testSql`insert into services (category_id, name, slug, price_paise, duration_min)
                              values (${cat.id}, 'Gel', ${`${tag}-gel`}, 120000, 60) returning id`;
  const [a] = await testSql`insert into staff (name, slug, sort_order) values ('Admin A', ${`${tag}-a`}, 1) returning id`;
  const [u] = await testSql`insert into users (name, email, role) values ('Desk', ${`${tag}@daybook.test`}, 'receptionist') returning id`;
  Object.assign(ids, { cat: cat.id, gel: gel.id, a: a.id, user: u.id });
  await testSql`insert into staff_services (staff_id, service_id) values (${a.id}, ${gel.id})`;
  await testSql`insert into staff_shifts (staff_id, weekday, starts_at, ends_at) values (${a.id}, ${WEEKDAY}, '11:00', '20:00')`;
});

afterAll(async () => {
  const booked = await testSql<{ id: string }[]>`
    select id from bookings where customer_id in (select id from customers where phone in ${testSql(PHONES)})`;
  await cleanupBookingEvents(booked.map((b) => b.id));
  await testSql`delete from bookings where customer_id in (select id from customers where phone in ${testSql(PHONES)})`;
  await testSql`delete from customers where phone in ${testSql(PHONES)}`;
  await testSql`delete from staff where id = ${ids.a}`;
  await testSql`delete from services where category_id = ${ids.cat}`;
  await testSql`delete from service_categories where id = ${ids.cat}`;
  await testSql`delete from users where id = ${ids.user}`;
  await testSql`delete from opening_hours where weekday = ${WEEKDAY}`;
  await Promise.all([testSql.end(), sql.end()]);
});

function walkIn(time: string, phone: string, name = "Walk In") {
  return createAdminBooking({
    serviceIds: [ids.gel],
    date: DATE,
    startMinutes: timeToMinutes(time),
    customer: { name, phone },
    source: "walk_in",
    createdByUserId: ids.user,
  });
}

describe("createAdminBooking", () => {
  it("creates a confirmed booking with nothing due online, recording who made it", async () => {
    const booking = await walkIn("12:00", PHONES[0]);
    expect(booking).toMatchObject({ status: "confirmed", source: "walk_in", amountDueNowPaise: 0, totalPaise: 120000, staffName: "Admin A" });
    const [row] = await testSql`select created_by_user_id, hold_expires_at from bookings where id = ${booking.id}`;
    expect(row).toEqual({ created_by_user_id: ids.user, hold_expires_at: null });
  });

  it("refuses an overlapping time for the same artist", async () => {
    await expect(walkIn("12:30", PHONES[1])).rejects.toMatchObject({ code: "slot_unavailable" });
  });

  it("lets the front desk correct a returning customer's name", async () => {
    await walkIn("14:00", PHONES[2], "Old Name");
    await walkIn("16:00", PHONES[2], "Corrected Name");
    const [c] = await testSql`select name from customers where phone = ${PHONES[2]}`;
    expect(c.name).toBe("Corrected Name");
  });
});

describe("applyBookingAction", () => {
  it("moves through complete → reopen → cancel and records the reason", async () => {
    const booking = await walkIn("18:00", PHONES[3]);
    expect((await applyBookingAction({ bookingId: booking.id, action: "complete" })).status).toBe("completed");
    expect((await applyBookingAction({ bookingId: booking.id, action: "reopen" })).status).toBe("confirmed");
    const cancelled = await applyBookingAction({ bookingId: booking.id, action: "cancel", reason: " Customer called " });
    expect(cancelled).toMatchObject({ status: "cancelled", cancelReason: "Customer called" });
    await expect(applyBookingAction({ bookingId: booking.id, action: "reopen" })).rejects.toMatchObject({ code: "not_allowed" });
  });

  it("frees the slot once cancelled", async () => {
    const again = await walkIn("18:00", PHONES[3]);
    expect(again.status).toBe("confirmed");
  });

  it("reports unknown bookings", async () => {
    await expect(
      applyBookingAction({ bookingId: "01900000-0000-7000-8000-000000000000", action: "cancel" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("schedule and list", () => {
  it("returns the day's staff, shifts and bookings in IST minutes", async () => {
    const day = await getDaySchedule(DATE);
    expect(day.opening).toEqual({ start: 660, end: 1200 });
    const a = day.staff.find((s) => s.id === ids.a);
    expect(a?.shifts).toEqual([{ start: 660, end: 1200 }]);
    const noon = day.bookings.find((b) => b.staffId === ids.a && b.startMin === 720);
    expect(noon).toMatchObject({ endMin: 780, customer: { phone: PHONES[0] }, items: [{ name: "Gel", pricePaise: 120000, durationMin: 60 }] });
  });

  it("searches by phone digits and filters by status", async () => {
    const byPhone = await listBookings({ q: "83000 00003", from: DATE, to: DATE });
    expect(byPhone.rows.every((b) => b.customer.phone === PHONES[2])).toBe(true);
    expect(byPhone.total).toBe(2);
    const cancelled = await listBookings({ status: "cancelled", from: DATE, to: DATE });
    expect(cancelled.rows.map((b) => b.customer.phone)).toEqual([PHONES[3]]);
  });
});
