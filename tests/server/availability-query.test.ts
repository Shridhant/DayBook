import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { addDays, formatTime, istToday, weekdayOf } from "@/lib/time";
import { AvailabilityError, getAvailability } from "@/server/availability-query";
import { testSql } from "../helpers/test-db";

/**
 * Integration test for the SQL loader against the TEST database (vitest.config swaps DATABASE_URL).
 * getAvailability uses its own pool, so fixtures are committed here and deleted in afterAll.
 */

const DATE = addDays(istToday(), 3); // inside the window, outside the lead time
const WEEKDAY = weekdayOf(DATE);
const tag = `av${Date.now().toString(36)}`;
const ids: Record<string, string> = {};

beforeAll(async () => {
  expect(new URL(process.env.DATABASE_URL ?? "").pathname).toBe("/daybook_test");

  await testSql`insert into opening_hours (weekday, opens_at, closes_at) values (${WEEKDAY}, '11:00', '20:00')
                on conflict (weekday) do update set opens_at = '11:00', closes_at = '20:00'`;
  const [cat] = await testSql`insert into service_categories (name, slug) values ('AV', ${`${tag}-cat`}) returning id`;
  const [gel] = await testSql`insert into services (category_id, name, slug, price_paise, duration_min)
                              values (${cat.id}, 'Gel', ${`${tag}-gel`}, 120000, 60) returning id`;
  const [art] = await testSql`insert into services (category_id, name, slug, price_paise, duration_min)
                              values (${cat.id}, 'Art', ${`${tag}-art`}, 80000, 45) returning id`;
  const [off] = await testSql`insert into services (category_id, name, slug, price_paise, duration_min, active)
                              values (${cat.id}, 'Retired', ${`${tag}-off`}, 1000, 30, false) returning id`;
  const [a] = await testSql`insert into staff (name, slug, sort_order) values ('Both', ${`${tag}-a`}, 1) returning id`;
  const [b] = await testSql`insert into staff (name, slug, sort_order) values ('Gel only', ${`${tag}-b`}, 2) returning id`;
  const [c] = await testSql`insert into customers (name, phone) values ('AV', '9000000001')
                            on conflict (phone) do update set name = excluded.name returning id`;
  Object.assign(ids, { cat: cat.id, gel: gel.id, art: art.id, off: off.id, a: a.id, b: b.id, customer: c.id });

  await testSql`insert into staff_services (staff_id, service_id)
                values (${a.id}, ${gel.id}), (${a.id}, ${art.id}), (${b.id}, ${gel.id})`;
  for (const s of [a.id, b.id]) {
    await testSql`insert into staff_shifts (staff_id, weekday, starts_at, ends_at) values (${s}, ${WEEKDAY}, '11:00', '20:00')`;
  }
  // Tech A is busy 16:00–17:00 IST; a cancelled booking at 12:00 must not block.
  await testSql`insert into bookings (code, customer_id, staff_id, starts_at, ends_at, status, source, total_paise)
                values (${`DB-${tag.slice(-6).toUpperCase()}`}, ${c.id}, ${a.id},
                        ${`${DATE} 16:00+05:30`}, ${`${DATE} 17:00+05:30`}, 'confirmed', 'online', 120000)`;
  await testSql`insert into bookings (code, customer_id, staff_id, starts_at, ends_at, status, source, total_paise, cancelled_at)
                values (${`DB-C${tag.slice(-5).toUpperCase()}`}, ${c.id}, ${a.id},
                        ${`${DATE} 12:00+05:30`}, ${`${DATE} 13:00+05:30`}, 'cancelled', 'online', 120000, now())`;
});

afterAll(async () => {
  await testSql`delete from bookings where customer_id = ${ids.customer}`;
  await testSql`delete from customers where id = ${ids.customer}`;
  await testSql`delete from staff where id in ${testSql([ids.a, ids.b])}`;
  await testSql`delete from services where category_id = ${ids.cat}`;
  await testSql`delete from service_categories where id = ${ids.cat}`;
  await testSql`delete from salon_closures where date = ${DATE}`;
  await testSql`delete from opening_hours where weekday = ${WEEKDAY}`;
  await Promise.all([testSql.end(), sql.end()]);
});

const labels = (r: Awaited<ReturnType<typeof getAvailability>>) => r.slots.map((s) => formatTime(s.minutes));

describe("getAvailability (database)", () => {
  it("sums durations and only uses technicians qualified for every service", async () => {
    const both = await getAvailability({ date: DATE, serviceIds: [ids.gel, ids.art] });
    expect(both.durationMin).toBe(105);
    // Only tech A does both, and A is busy 16:00–17:00, so a 105-min slot can't start 14:30–16:45.
    expect(labels(both)).toContain("2:15 pm"); // ends 4:00 pm
    expect(labels(both)).not.toContain("2:30 pm");
    expect(labels(both)).not.toContain("4:45 pm");
    expect(labels(both)).toContain("5:00 pm");
  });

  it("falls back to another technician for 'Any available'", async () => {
    const gel = await getAvailability({ date: DATE, serviceIds: [ids.gel] });
    expect(labels(gel)).toContain("4:00 pm"); // A is busy, B is free
    const slot = gel.slots.find((s) => formatTime(s.minutes) === "4:00 pm");
    expect(slot?.staffIds).toEqual([ids.b]);
  });

  it("restricts to a chosen technician", async () => {
    const onlyA = await getAvailability({ date: DATE, serviceIds: [ids.gel], staffId: ids.a });
    expect(labels(onlyA)).not.toContain("4:00 pm");
    expect(labels(onlyA)).toContain("12:00 pm"); // the cancelled booking doesn't block
  });

  it("rejects inactive or unknown services and unqualified technicians", async () => {
    await expect(getAvailability({ date: DATE, serviceIds: [ids.off] })).rejects.toMatchObject({ code: "unknown_service" });
    await expect(
      getAvailability({ date: DATE, serviceIds: [ids.art], staffId: ids.b }),
    ).rejects.toMatchObject({ code: "staff_not_qualified" });
    await expect(
      getAvailability({ date: DATE, serviceIds: [ids.gel], staffId: "01900000-0000-7000-8000-000000000000" }),
    ).rejects.toBeInstanceOf(AvailabilityError);
  });

  it("closes the day when there is a salon closure", async () => {
    await testSql`insert into salon_closures (date, reason) values (${DATE}, 'Test holiday')`;
    const closed = await getAvailability({ date: DATE, serviceIds: [ids.gel] });
    expect(closed.closedReason).toBe("closed");
    expect(closed.slots).toEqual([]);
    await testSql`delete from salon_closures where date = ${DATE}`;
  });
});
