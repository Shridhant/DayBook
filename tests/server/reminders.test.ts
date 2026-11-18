import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { reminderKey } from "@/server/notifications";
import { queueDueReminders, REMINDER_HOURS } from "@/server/reminders";
import { cleanupBookingEvents, testSql } from "../helpers/test-db";

/**
 * Reminders against the TEST database. Times are relative to a fixed "now" passed in, far in the
 * future (2030), so these bookings never meet other test files' fixtures.
 */

const NOW = new Date("2030-03-10T05:00:00Z"); // 10:30 am IST
const HOUR = 3_600_000;
const tag = `rm${Date.now().toString(36)}`;
const ids: Record<string, string> = {};
let seq = 0;

beforeAll(async () => {
  const [a] = await testSql`insert into staff (name, slug) values ('Remind A', ${`${tag}-a`}) returning id`;
  const [withEmail] = await testSql`insert into customers (name, phone, email) values ('Asha Remind', '8500000001', 'asha.remind@mail.daybook-tests.in') returning id`;
  const [noEmail] = await testSql`insert into customers (name, phone) values ('No Email', '8500000002') returning id`;
  Object.assign(ids, { staff: a.id, withEmail: withEmail.id, noEmail: noEmail.id });
});

afterAll(async () => {
  const booked = await testSql<{ id: string }[]>`select id from bookings where staff_id = ${ids.staff}`;
  await cleanupBookingEvents(booked.map((b) => b.id));
  await testSql`delete from bookings where staff_id = ${ids.staff}`;
  await testSql`delete from customers where id in ${testSql([ids.withEmail, ids.noEmail])}`;
  await testSql`delete from staff where id = ${ids.staff}`;
  await Promise.all([testSql.end(), sql.end()]);
});

/** A 1-hour booking starting `inHours` after NOW, made `bookedHoursBefore` hours before it starts. */
async function booking(inHours: number, opts: { bookedHoursBefore?: number; status?: string; customer?: string } = {}) {
  const startsAt = new Date(NOW.getTime() + inHours * HOUR);
  const createdAt = new Date(startsAt.getTime() - (opts.bookedHoursBefore ?? 72) * HOUR);
  const status = opts.status ?? "confirmed";
  const [b] = await testSql<{ id: string }[]>`
    insert into bookings (code, customer_id, customer_email, staff_id, starts_at, ends_at, status, source, total_paise, created_at, cancelled_at)
    values (${`DB-Q${String(++seq).padStart(5, "0")}`}, ${opts.customer ?? ids.withEmail}, (select email from customers where id = ${opts.customer ?? ids.withEmail}), ${ids.staff}, ${startsAt},
            ${new Date(startsAt.getTime() + HOUR)}, ${status}, 'online', 120000, ${createdAt}, ${status === "cancelled" ? NOW : null})
    returning id`;
  await testSql`insert into booking_items (booking_id, service_id, name_snapshot, price_snapshot_paise, duration_snapshot_min)
                select ${b.id}, id, 'Gel polish', 120000, 60 from services limit 1`;
  return { id: b.id, startsAt };
}

async function reminderFor(id: string, startsAt: Date) {
  const [row] = await testSql<{ subject: string; to_email: string; text_body: string }[]>`
    select subject, to_email, text_body from email_outbox where dedupe_key = ${reminderKey(id, startsAt)}`;
  return row;
}

describe("appointment reminders", () => {
  it(`reminds about bookings in the next ${REMINDER_HOURS} hours, once`, async () => {
    const b = await booking(20);
    expect(await queueDueReminders(NOW)).toBe(1);
    const email = await reminderFor(b.id, b.startsAt);
    expect(email).toMatchObject({ to_email: "asha.remind@mail.daybook-tests.in" });
    expect(email.subject).toMatch(/^Reminder: tomorrow at 6:30 am \(DB-Q\d+\)$/);
    expect(email.text_body).toContain("View or change booking: http");
    // Booked with a 24h cancel window and reminded 20h before: no longer free to change.
    expect(email.text_body).toContain("Please cancel with the link");

    expect(await queueDueReminders(NOW)).toBe(0); // the next minute's run doesn't send it again
  });

  it("skips bookings that are too far off, too close, or made at short notice", async () => {
    const far = await booking(30);
    const close = await booking(1);
    const lastMinute = await booking(10, { bookedHoursBefore: 5 });
    await queueDueReminders(NOW);
    for (const b of [far, close, lastMinute]) expect(await reminderFor(b.id, b.startsAt)).toBeUndefined();
  });

  it("skips cancelled bookings and customers without an email", async () => {
    const cancelled = await booking(12, { status: "cancelled" });
    const noEmail = await booking(14, { customer: ids.noEmail });
    await queueDueReminders(NOW);
    expect(await reminderFor(cancelled.id, cancelled.startsAt)).toBeUndefined();
    expect(await testSql`select 1 from email_outbox where dedupe_key like ${`reminder:${noEmail.id}:%`}`).toHaveLength(0);
  });

  it("reminds again about the new time when a booking is moved", async () => {
    const b = await booking(16);
    await queueDueReminders(NOW);
    const moved = new Date(b.startsAt.getTime() + 2 * HOUR);
    await testSql`update bookings set starts_at = ${moved}, ends_at = ${new Date(moved.getTime() + HOUR)} where id = ${b.id}`;
    expect(await queueDueReminders(NOW)).toBe(1);
    expect(await reminderFor(b.id, moved)).toBeDefined();
  });

  it("says changes are still free when the cancel window allows it", async () => {
    await testSql`update settings set cancel_window_hours = 6`;
    try {
      const b = await booking(22);
      await queueDueReminders(NOW);
      expect((await reminderFor(b.id, b.startsAt)).text_body).toContain("You can change or cancel for free until");
    } finally {
      await testSql`update settings set cancel_window_hours = 24`;
    }
  });
});
