import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { addDays, istToday } from "@/lib/time";
import { listNotifications, markNotificationsRead } from "@/server/admin/notifications-admin";
import { backoffMinutes, MAX_ATTEMPTS, processEmailOutbox } from "@/server/email";
import { escapeHtml, ownerBookingConfirmedEmail, type BookingSummary } from "@/server/email-templates";
import { onBookingConfirmed, onPaymentNeedsReview } from "@/server/notifications";
import { cleanupBookingEvents, testSql } from "../helpers/test-db";

/** Notifications and the email outbox against the TEST database (SMTP is never configured in tests). */

const DATE = addDays(istToday(), 10);
const tag = `nt${Date.now().toString(36)}`;
const ids: Record<string, string> = {};
const bookingIds: string[] = [];
let seq = 0;

beforeAll(async () => {
  const [st] = await testSql`insert into staff (name, slug) values ('Notify A', ${`${tag}-a`}) returning id`;
  const [withEmail] = await testSql`insert into customers (name, phone, email) values ('Mira <b>Joshi</b>', '8500000001', 'mira@mail.daybook-tests.in') returning id`;
  const [noEmail] = await testSql`insert into customers (name, phone) values ('No Email', '8500000002') returning id`;
  const [u1] = await testSql`insert into users (name, email, role, created_at) values ('N1', ${`n1-${tag}@daybook.test`}, 'owner', now() - interval '1 day') returning id`;
  const [u2] = await testSql`insert into users (name, email, role, created_at) values ('N2', ${`n2-${tag}@daybook.test`}, 'receptionist', now() - interval '1 day') returning id`;
  Object.assign(ids, { staff: st.id, withEmail: withEmail.id, noEmail: noEmail.id, u1: u1.id, u2: u2.id });
});

afterAll(async () => {
  await cleanupBookingEvents(bookingIds);
  await testSql`delete from email_outbox where dedupe_key like ${`${tag}%`}`;
  await testSql`delete from bookings where id in ${testSql(bookingIds.length ? bookingIds : ["00000000-0000-0000-0000-000000000000"])}`;
  await testSql`delete from customers where id in ${testSql([ids.withEmail, ids.noEmail])}`;
  await testSql`delete from staff where id = ${ids.staff}`;
  await testSql`delete from users where id in ${testSql([ids.u1, ids.u2])}`;
  await Promise.all([testSql.end(), sql.end()]);
});

async function booking(customerId: string, source: "online" | "walk_in" = "online") {
  const n = ++seq;
  const [b] = await testSql<{ id: string }[]>`
    insert into bookings (code, customer_id, staff_id, starts_at, ends_at, status, source, total_paise)
    values (${`DB-N${String(n).padStart(4, "0")}`}, ${customerId}, ${ids.staff},
            ${`${DATE} 00:00+05:30`}::timestamptz + make_interval(hours => ${n}),
            ${`${DATE} 00:00+05:30`}::timestamptz + make_interval(hours => ${n}, mins => 45),
            'confirmed', ${source}, 120000)
    returning id`;
  await testSql`insert into booking_items (booking_id, service_id, name_snapshot, price_snapshot_paise, duration_snapshot_min)
                select ${b.id}, id, 'Gel <manicure>', 120000, 45 from services limit 1`;
  bookingIds.push(b.id);
  return b.id;
}

const outboxFor = (bookingId: string) =>
  testSql<{ to_email: string; subject: string; html: string; ics: string | null }[]>`
    select to_email, subject, html, ics from email_outbox where dedupe_key like ${`%${bookingId}%`} order by to_email`;

describe("onBookingConfirmed", () => {
  it("creates one in-app notification and queues owner + customer emails (with a calendar invite)", async () => {
    const id = await booking(ids.withEmail);
    await sql.begin((tx) => onBookingConfirmed(tx, id));

    const [note] = await testSql`select type, title from notifications where booking_id = ${id}`;
    expect(note).toMatchObject({ type: "booking_confirmed", title: "New booking: Mira <b>Joshi</b>" });

    const mail = await outboxFor(id);
    expect(mail.map((m) => m.to_email)).toEqual(["mira@mail.daybook-tests.in", "owner-a@mail.daybook-tests.in", "owner-b@mail.daybook-tests.in"]);
    const customer = mail.find((m) => m.to_email === "mira@mail.daybook-tests.in");
    expect(customer?.ics).toContain("BEGIN:VEVENT");
    // Customer-supplied text is escaped in HTML.
    expect(mail.every((m) => !m.html.includes("<b>Joshi</b>"))).toBe(true);
    // The owner email shows the full name (escaped); the customer email greets by first name only.
    expect(mail.find((m) => m.to_email === "owner-a@mail.daybook-tests.in")?.html).toContain("Mira &lt;b&gt;Joshi&lt;/b&gt;");
  });

  it("is idempotent: a retried webhook doesn't duplicate anything", async () => {
    const id = await booking(ids.withEmail);
    await onBookingConfirmed(sql, id);
    await onBookingConfirmed(sql, id);
    const [{ notes }] = await testSql<{ notes: number }[]>`select count(*)::int as notes from notifications where booking_id = ${id}`;
    expect(notes).toBe(1);
    expect(await outboxFor(id)).toHaveLength(3);
  });

  it("skips the customer email when they gave none, and skips front-desk bookings entirely", async () => {
    const online = await booking(ids.noEmail);
    await onBookingConfirmed(sql, online);
    expect((await outboxFor(online)).map((m) => m.to_email)).toEqual(["owner-a@mail.daybook-tests.in", "owner-b@mail.daybook-tests.in"]);

    const walkIn = await booking(ids.noEmail, "walk_in");
    await onBookingConfirmed(sql, walkIn);
    expect(await outboxFor(walkIn)).toHaveLength(0);
    const [{ notes }] = await testSql<{ notes: number }[]>`select count(*)::int as notes from notifications where booking_id = ${walkIn}`;
    expect(notes).toBe(0);
  });

  it("alerts the owner when a payment needs attention", async () => {
    const id = await booking(ids.noEmail);
    await onPaymentNeedsReview(sql, id, `pay_${tag}`, "Paid after the slot was taken.");
    const [note] = await testSql`select type, body from notifications where booking_id = ${id}`;
    expect(note).toEqual({ type: "payment_review", body: "Paid after the slot was taken." });
    expect((await outboxFor(`pay_${tag}`)).every((m) => m.subject.startsWith("Action needed"))).toBe(true);
  });
});

describe("in-app read state", () => {
  it("is tracked per person", async () => {
    const before1 = await listNotifications(ids.u1);
    const before2 = await listNotifications(ids.u2);
    expect(before1.unread).toBeGreaterThan(0);
    expect(before1.unread).toBe(before2.unread);

    await markNotificationsRead(ids.u1, [before1.items[0].id]);
    expect((await listNotifications(ids.u1)).unread).toBe(before1.unread - 1);
    expect((await listNotifications(ids.u2)).unread).toBe(before2.unread);

    await markNotificationsRead(ids.u2, "all");
    expect((await listNotifications(ids.u2)).unread).toBe(0);
  });

  it("doesn't show older notifications to someone who joined later", async () => {
    const [late] = await testSql`insert into users (name, email, role) values ('Late', ${`late-${tag}@daybook.test`}, 'receptionist') returning id`;
    expect((await listNotifications(late.id)).items.filter((n) => n.title.includes("Mira"))).toHaveLength(0);
    await testSql`delete from users where id = ${late.id}`;
  });
});

describe("email outbox", () => {
  async function queue(key: string, createdAgo = "0 minutes") {
    await testSql`
      insert into email_outbox (dedupe_key, to_email, subject, html, text_body, created_at)
      values (${key}, 'someone@mail.daybook-tests.in', ${key}, '<p>Hi</p>', 'Hi', now() - ${createdAgo}::interval)`;
  }
  const row = async (key: string) => {
    const [r] = await testSql<{ status: string; attempts: number; last_error: string | null; due_in_min: number }[]>`
      select status, attempts, last_error, round(extract(epoch from next_attempt_at - now()) / 60)::int as due_in_min
      from email_outbox where dedupe_key = ${key}`;
    return r;
  };

  it("does nothing when SMTP isn't configured", async () => {
    await queue(`${tag}-unconfigured`);
    expect(await processEmailOutbox()).toMatchObject({ skipped: true });
    expect((await row(`${tag}-unconfigured`)).status).toBe("pending");
    await testSql`delete from email_outbox where dedupe_key = ${`${tag}-unconfigured`}`;
  });

  it("marks sent mail, and retries failures with backoff before giving up", async () => {
    await queue(`${tag}-ok`);
    await queue(`${tag}-bad`);
    // Each test email's subject is its key, so the fake SMTP server can reject just one of them.
    const send = async (r: { subject: string }) => {
      if (r.subject === `${tag}-bad`) throw new Error("SMTP 550 rejected");
    };
    await processEmailOutbox({ send });
    const ok = await row(`${tag}-ok`);
    const bad = await row(`${tag}-bad`);
    expect(ok.status).toBe("sent");
    expect(bad).toMatchObject({ status: "pending", attempts: 1, last_error: "SMTP 550 rejected" });
    expect(bad.due_in_min).toBe(backoffMinutes(1));

    // Exhaust the attempts.
    await testSql`update email_outbox set attempts = ${MAX_ATTEMPTS - 1}, next_attempt_at = now() where dedupe_key = ${`${tag}-bad`}`;
    await processEmailOutbox({ send: async () => Promise.reject(new Error("still failing")) });
    expect((await row(`${tag}-bad`)).status).toBe("failed");
  });

  it("never sends to test-only addresses (demo customers)", async () => {
    await testSql`
      insert into email_outbox (dedupe_key, to_email, subject, html, text_body)
      values (${`${tag}-demo`}, 'asha.k@example.com', 'x', '<p>x</p>', 'x')`;
    let sent = 0;
    await processEmailOutbox({ send: async () => void sent++ });
    expect(sent).toBe(0);
    expect(await row(`${tag}-demo`)).toMatchObject({ status: "failed", last_error: "Test-only address, not sent" });
  });

  it("expires mail older than a day instead of sending it late", async () => {
    await queue(`${tag}-old`, "25 hours");
    await processEmailOutbox({ send: async () => {} });
    expect((await row(`${tag}-old`)).status).toBe("expired");
  });
});

describe("templates", () => {
  it("escapes HTML in every interpolated value", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe("&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;");
    const b: BookingSummary = {
      id: "x",
      code: "DB-ABC234",
      source: "online",
      customerName: "<script>x</script>",
      customerPhone: "9876543210",
      customerEmail: null,
      staffName: "Riya",
      startsAt: new Date("2026-11-20T11:00:00Z"),
      endsAt: new Date("2026-11-20T12:00:00Z"),
      items: [{ name: "Gel", pricePaise: 120000 }],
      totalPaise: 120000,
      paidPaise: 50000,
      notes: "<a href=evil>",
    };
    const mail = ownerBookingConfirmedEmail(b, "Daybook");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<a href=evil>");
    expect(mail.text).toContain("Due at the studio: ₹700");
    expect(mail.subject).toContain("Fri, 20 Nov 4:30 pm");
  });
});
