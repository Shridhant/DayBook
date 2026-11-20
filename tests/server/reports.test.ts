import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { getReport, type ReportFilters } from "@/server/reports";
import { testSql } from "../helpers/test-db";

/**
 * Reports against the TEST database: one artist, two days in March 2021 (Mon 1 and Tue 2), so no
 * other test file's bookings fall in range. Every query is filtered to this artist.
 */

const tag = `rep${Date.now().toString(36)}`;
const NOW = new Date("2021-06-01T06:30:00Z");
const ids: Record<string, string> = {};

const at = (date: string, time: string) => `${date} ${time}+05:30`;

async function book(o: {
  customer: string;
  date: string;
  from: string;
  to: string;
  status: string;
  source: string;
  items: string[];
  createdAt?: string;
  paid?: number;
}) {
  const prices = await testSql<{ id: string; name: string; price_paise: number; duration_min: number }[]>`
    select id, name, price_paise, duration_min from services where id in ${testSql(o.items)}`;
  const total = o.items.reduce((s, id) => s + (prices.find((p) => p.id === id)?.price_paise ?? 0), 0);
  const [b] = await testSql<{ id: string }[]>`
    insert into bookings (code, customer_id, staff_id, starts_at, ends_at, status, source, total_paise, cancelled_at, created_at)
    values (${`DB-${Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[^A-Z0-9]/g, "Z")}`}, ${o.customer}, ${ids.staff},
            ${at(o.date, o.from)}, ${at(o.date, o.to)}, ${o.status}, ${o.source}, ${total},
            ${o.status === "cancelled" ? at(o.date, "09:00") : null}, ${o.createdAt ?? new Date()})
    returning id`;
  for (const [position, id] of o.items.entries()) {
    const p = prices.find((x) => x.id === id);
    if (!p) throw new Error("service missing");
    await testSql`
      insert into booking_items (booking_id, service_id, name_snapshot, price_snapshot_paise, duration_snapshot_min, position)
      values (${b.id}, ${p.id}, ${p.name}, ${p.price_paise}, ${p.duration_min}, ${position})`;
  }
  if (o.paid) {
    await testSql`
      insert into payments (booking_id, rzp_order_id, amount_paise, status)
      values (${b.id}, ${`order_${tag}_${b.id}`}, ${o.paid}, 'captured')`;
  }
  return b.id;
}

const filters = (f: Partial<ReportFilters> = {}): ReportFilters => ({
  from: "2021-03-01",
  to: "2021-03-02",
  staffId: ids.staff,
  categoryId: null,
  source: null,
  ...f,
});

beforeAll(async () => {
  const [catA] = await testSql`insert into service_categories (name, slug) values ('Rep A', ${`${tag}-a`}) returning id`;
  const [catB] = await testSql`insert into service_categories (name, slug) values ('Rep B', ${`${tag}-b`}) returning id`;
  const [gel] = await testSql`
    insert into services (category_id, name, slug, price_paise, duration_min) values (${catA.id}, 'Rep gel', ${`${tag}-gel`}, 100000, 60) returning id`;
  const [art] = await testSql`
    insert into services (category_id, name, slug, price_paise, duration_min) values (${catB.id}, 'Rep art', ${`${tag}-art`}, 50000, 30) returning id`;
  const [staff] = await testSql`insert into staff (name, slug) values ('Rep Artist', ${`${tag}-artist`}) returning id`;
  await testSql`
    insert into staff_shifts (staff_id, weekday, starts_at, ends_at)
    values (${staff.id}, 1, '10:00', '18:00'), (${staff.id}, 2, '10:00', '18:00')`;
  await testSql`
    insert into staff_leave (staff_id, starts_at, ends_at, reason, status)
    values (${staff.id}, ${at("2021-03-02", "10:00")}, ${at("2021-03-02", "12:00")}, ${tag}, 'approved'),
           (${staff.id}, ${at("2021-03-01", "10:00")}, ${at("2021-03-01", "18:00")}, ${tag}, 'requested')`;
  const customers = await testSql<{ id: string }[]>`
    insert into customers (name, phone) values ('Rep One', '8400011001'), ('Rep Two', '8400011002'), ('Rep Three', '8400011003')
    returning id`;
  Object.assign(ids, { catA: catA.id, catB: catB.id, gel: gel.id, art: art.id, staff: staff.id });
  const [c1, c2, c3] = customers.map((c) => c.id);
  Object.assign(ids, { c1, c2, c3 });

  // c1: a visit in February, so they're returning in March.
  await book({ customer: c1, date: "2021-02-22", from: "10:00", to: "11:00", status: "completed", source: "phone", items: [ids.gel] });
  await book({ customer: c1, date: "2021-03-01", from: "10:00", to: "11:00", status: "completed", source: "online", items: [ids.gel], createdAt: at("2021-02-26", "12:00"), paid: 30000 });
  await book({ customer: c1, date: "2021-03-01", from: "11:00", to: "11:30", status: "no_show", source: "online", items: [ids.art], paid: 20000 });
  // c2: first visit ever.
  await book({ customer: c2, date: "2021-03-02", from: "12:00", to: "13:30", status: "completed", source: "walk_in", items: [ids.gel, ids.art] });
  await book({ customer: c2, date: "2021-03-02", from: "14:00", to: "15:00", status: "cancelled", source: "phone", items: [ids.gel] });
  await book({ customer: c2, date: "2021-03-02", from: "16:00", to: "17:00", status: "confirmed", source: "phone", items: [ids.gel] });
  // c3: a regular (two visits) who has already booked again, so not someone to win back.
  await book({ customer: c3, date: "2021-02-22", from: "12:00", to: "13:00", status: "completed", source: "phone", items: [ids.gel] });
  await book({ customer: c3, date: "2021-02-23", from: "12:00", to: "13:00", status: "completed", source: "phone", items: [ids.gel] });
  await book({ customer: c3, date: "2021-06-07", from: "10:00", to: "11:00", status: "confirmed", source: "phone", items: [ids.gel] });
});

afterAll(async () => {
  const bookings = await testSql<{ id: string }[]>`select id from bookings where staff_id = ${ids.staff}`;
  if (bookings.length) {
    const list = testSql(bookings.map((b) => b.id));
    await testSql`delete from payments where booking_id in ${list}`;
    await testSql`delete from booking_items where booking_id in ${list}`;
    await testSql`delete from bookings where id in ${list}`;
  }
  await testSql`delete from customers where phone like '840001100%'`;
  await testSql`delete from salon_closures where reason = ${tag}`;
  await testSql`delete from staff where id = ${ids.staff}`;
  await testSql`delete from services where slug like ${`${tag}%`}`;
  await testSql`delete from service_categories where slug like ${`${tag}%`}`;
  await Promise.all([testSql.end(), sql.end()]);
});

describe("report summary", () => {
  it("counts revenue from completed bookings, and booking amounts kept from no-shows", async () => {
    const { summary, comparison } = await getReport(filters(), NOW);
    expect(summary).toEqual({
      revenuePaise: 250000, // ₹1,000 gel + ₹1,500 gel and art
      upcomingPaise: 0,
      unmarked: 1, // the past confirmed booking nobody marked
      bookings: 4, // cancelled not counted
      completed: 2,
      noShows: 1,
      cancelled: 1,
      clients: 2,
      newClients: 1, // c2; c1 came in February
      collectedPaise: 50000,
      refundedPaise: 0,
      keptFromNoShowsPaise: 20000,
      bookedMinutes: 240,
      capacityMinutes: 840, // 2 × 8h shifts minus 2h approved leave (the requested leave doesn't count)
    });
    // A finished period compares in full with the days just before it.
    expect(comparison?.currentRange).toEqual({ from: "2021-03-01", to: "2021-03-02" });
    expect(comparison?.previousRange).toEqual({ from: "2021-02-27", to: "2021-02-28" });
    expect(comparison?.current).toEqual(summary);
    expect(comparison?.previous.bookings).toBe(0);
  });

  it("filters by category (counting only that category's services) and by channel", async () => {
    const art = await getReport(filters({ categoryId: ids.catB }), NOW);
    expect(art.summary).toMatchObject({ revenuePaise: 50000, bookings: 2, completed: 1, noShows: 1 });
    expect(art.services.map((s) => s.id)).toEqual([ids.art]);

    const walkIns = await getReport(filters({ source: "walk_in" }), NOW);
    expect(walkIns.summary).toMatchObject({ revenuePaise: 150000, bookings: 1, clients: 1 });
  });

  it("removes closed days from shift capacity", async () => {
    await testSql`insert into salon_closures (date, reason) values ('2021-03-02', ${tag})`;
    try {
      const { summary } = await getReport(filters(), NOW);
      expect(summary.capacityMinutes).toBe(480);
    } finally {
      await testSql`delete from salon_closures where reason = ${tag}`;
    }
  });
});

describe("report breakdowns", () => {
  it("builds the trend, channels, lead time, busy hours, services and artists", async () => {
    const r = await getReport(filters(), NOW);
    expect(r.bucket).toBe("day");
    expect(r.trend).toEqual([
      { key: "2021-03-01", revenuePaise: 100000, upcomingPaise: 0, bookings: 2 },
      { key: "2021-03-02", revenuePaise: 150000, upcomingPaise: 0, bookings: 2 },
    ]);
    expect(Object.fromEntries(r.channels.map((c) => [c.source, [c.bookings, c.valuePaise, c.noShows]]))).toEqual({
      online: [2, 100000, 1],
      walk_in: [1, 150000, 0],
      phone: [1, 100000, 0], // the cancelled phone booking is left out
    });
    // Walk-ins are excluded; bookings made "after" their date (created now) count as same day.
    expect(Object.fromEntries(r.leadTime.filter((l) => l.bookings).map((l) => [l.bucket, l.bookings]))).toEqual({ same_day: 2, "2_3_days": 1 });
    expect(r.heatmap.sort((a, b) => a.weekday - b.weekday || a.hour - b.hour)).toEqual([
      { weekday: 1, hour: 10, bookings: 1 },
      { weekday: 1, hour: 11, bookings: 1 },
      { weekday: 2, hour: 12, bookings: 1 },
      { weekday: 2, hour: 16, bookings: 1 },
    ]);
    expect(r.services.map((s) => [s.id, s.bookings, s.revenuePaise])).toEqual([
      [ids.gel, 3, 200000],
      [ids.art, 2, 50000],
    ]);
    expect(r.categories.map((c) => [c.id, c.bookings, c.revenuePaise])).toEqual([
      [ids.catA, 3, 200000],
      [ids.catB, 2, 50000],
    ]);
    expect(r.artists).toEqual([
      { id: ids.staff, name: "Rep Artist", photoPath: null, bookings: 4, completed: 2, noShows: 1, revenuePaise: 250000, bookedMinutes: 240, capacityMinutes: 840, clients: 2 },
    ]);
    // The dotted comparison line covers the period just before, bucketed the same way.
    expect(r.previousTrend?.length).toBeGreaterThan(0);
    expect(r.previousTrend?.every((p) => p.key < r.trend[0].key)).toBe(true);
  });

  it("ranks top clients by spend and lists lapsed regulars with nothing booked", async () => {
    const r = await getReport(filters(), NOW);
    expect(r.topClients.map((c) => [c.id, c.visits, c.spentPaise])).toEqual([
      [ids.c2, 1, 150000],
      [ids.c1, 1, 100000],
    ]);
    // c1: two visits, last on 1 March (> 45 days before NOW). c3 has a booking coming up.
    expect(r.winBack.map((c) => [c.id, c.visits, c.favourite])).toEqual([[ids.c1, 2, "Rep gel"]]);
  });
});
