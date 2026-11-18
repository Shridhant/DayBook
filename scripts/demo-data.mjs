// Fills the demo database with realistic activity: about six months of history (so Reports show
// growth, regulars, no-shows and lapsed clients) and two weeks ahead (calendar, bookings list,
// staff portal and notifications look like a busy salon during a pitch).
//
// Re-runnable: removes only what it created before (customers with phones 99999xxxxx, which no
// real Indian number uses here) and never touches other bookings. Run `npm run db:seed` first for
// the catalog and artists. Uses DATABASE_URL (the demo database). Never for a real salon.
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (expected in .env.local).");
  process.exit(1);
}
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to write demo data with NODE_ENV=production.");
  process.exit(1);
}
console.log(`→ Writing demo data to ${new URL(url).hostname}`);

const DAYS_BACK = 182;
const DAYS_AHEAD = 14;
const CUSTOMERS = 320;
const PHONE_PREFIX = "99999";
const IST_OFFSET_MS = 330 * 60_000;
const HOUR = 3_600_000;

/* ---------- Deterministic randomness (same demo all day, different tomorrow) ---------- */

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const now = new Date();
const todayIst = new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const random = mulberry32(Number(todayIst.replaceAll("-", "")));
const pick = (list) => list[Math.floor(random() * list.length)];
const chance = (p) => random() < p;

/* ---------- IST helpers (plain JS: this script runs outside the app) ---------- */

const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 24 * HOUR).toISOString().slice(0, 10);
const weekday = (key) => new Date(`${key}T00:00:00Z`).getUTCDay();
const istInstant = (key, minutes) => new Date(Date.parse(`${key}T00:00:00Z`) + minutes * 60_000 - IST_OFFSET_MS);
const toMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/* ---------- Demo people ---------- */

const FIRST = ["Aanya", "Ishita", "Kriti", "Nisha", "Priya", "Sneha", "Tanvi", "Diya", "Kavya", "Riddhi", "Simran", "Mehak",
  "Aditi", "Neha", "Pooja", "Shreya", "Trisha", "Zoya", "Ananya", "Sakshi", "Radhika", "Muskan", "Isha", "Tara",
  "Naina", "Avni", "Roshni", "Khushi", "Vani", "Rhea"];
const LAST = ["Malhotra", "Bansal", "Arora", "Khanna", "Gupta", "Sethi", "Chopra", "Kapoor", "Mehta", "Singh", "Batra",
  "Ahuja", "Jain", "Saxena", "Bhatia", "Oberoi", "Verma", "Dutta", "Kohli", "Sood"];
const NOTES = ["Almond shape, nude base please", "First time with extensions", "Wedding on Saturday!", "Allergic to some acetone removers",
  "Bringing a reference photo", "Short square, matte finish", "Running 10 min late sometimes, sorry!", "Pastel French tips"];

const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  const [settings] = await sql`select booking_amount_type, booking_amount_fixed_paise, booking_amount_percent from settings`;
  const staff = await sql`select id, name, slug from staff where active order by sort_order`;
  if (staff.length === 0) throw new Error("No artists found. Run `npm run db:seed` first.");
  const services = await sql`select id, name, price_paise, duration_min, booking_amount_override_paise from services where active`;
  const skills = await sql`select staff_id, service_id from staff_services`;
  const shifts = await sql`select staff_id, weekday, starts_at::text, ends_at::text from staff_shifts`;
  const hours = await sql`select weekday from opening_hours`;
  const openDays = new Set(hours.map((h) => h.weekday));
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const skillsOf = (staffId) => skills.filter((k) => k.staff_id === staffId).map((k) => serviceById.get(k.service_id)).filter(Boolean);
  const french = services.find((s) => /french|chrome/i.test(s.name));
  const admin = (await sql`select id from users where role in ('owner', 'receptionist') order by role limit 1`)[0];

  /** Same rule as lib/pricing.ts: largest override, else the settings rule, capped at the total. */
  function amountDueNow(items) {
    const total = items.reduce((s, i) => s + i.price_paise, 0);
    const overrides = items.map((i) => i.booking_amount_override_paise).filter((v) => v !== null);
    let amount;
    if (overrides.length) amount = Math.max(...overrides);
    else if (settings.booking_amount_type === "fixed") amount = settings.booking_amount_fixed_paise;
    else amount = Math.max(1000, Math.round((total * settings.booking_amount_percent) / 100 / 1000) * 1000);
    return Math.min(amount, total);
  }

  const codes = new Set((await sql`select code from bookings`).map((r) => r.code));
  const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  function code() {
    for (;;) {
      let c = "DB-";
      for (let i = 0; i < 6; i++) c += ALPHABET[Math.floor(random() * ALPHABET.length)];
      if (!codes.has(c)) {
        codes.add(c);
        return c;
      }
    }
  }

  await sql.begin(async (tx) => {
    // Remove the previous demo run (refunds/notifications/items cascade or are removed here).
    const old = await tx`select b.id from bookings b join customers c on c.id = b.customer_id where c.phone like ${`${PHONE_PREFIX}%`}`;
    if (old.length) {
      const ids = old.map((r) => r.id);
      await tx`delete from notifications where booking_id in ${tx(ids)}`;
      await tx`delete from email_outbox where exists (select 1 from unnest(${ids}::text[]) as id where dedupe_key like '%' || id || '%')`;
      await tx`delete from refunds where booking_id in ${tx(ids)}`;
      await tx`delete from payments where booking_id in ${tx(ids)}`;
      await tx`delete from booking_items where booking_id in ${tx(ids)}`;
      await tx`delete from bookings where id in ${tx(ids)}`;
    }
    await tx`delete from customers where phone like ${`${PHONE_PREFIX}%`}`;
    await tx`delete from staff_leave where reason like '[demo]%'`;
    await tx`delete from notifications where dedupe_key like 'demo:%'`;

    // Clients arrive over time (`joins` = first day they can book) with a habit: a few regulars
    // book often, most come now and then. Some regulars stop coming (`leaves`), so Reports has
    // lapsed clients to win back.
    const customers = [];
    for (let i = 0; i < CUSTOMERS; i++) {
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      const email = chance(0.75) ? `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com` : null;
      const joins = i < 70 ? -DAYS_BACK : -DAYS_BACK + Math.floor(random() * (DAYS_BACK + DAYS_AHEAD));
      const weight = chance(0.18) ? 6 : chance(0.4) ? 2 : 1;
      const leaves = weight > 1 && chance(0.2) ? -Math.floor(50 + random() * 100) : Infinity;
      customers.push({ id: randomUUID(), name, email, phone: `${PHONE_PREFIX}${String(i + 1).padStart(5, "0")}`, joins, weight, leaves });
    }
    const customerRows = customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      created_at: istInstant(addDays(todayIst, Math.max(-DAYS_BACK, c.joins)), 9 * 60),
    }));
    for (let i = 0; i < customerRows.length; i += 500) await tx`insert into customers ${tx(customerRows.slice(i, i + 500))}`;
    /** A client for a booking on `offset` (days from today), weighted by habit. */
    function clientFor(offset) {
      const able = customers.filter((c) => c.joins <= offset && offset < c.leaves);
      const total = able.reduce((s, c) => s + c.weight, 0);
      let r = random() * total;
      for (const c of able) if ((r -= c.weight) < 0) return c;
      return able[0] ?? customers[0];
    }

    // Leave first, so bookings avoid it: one approved (shows on the calendar), one waiting for the front desk.
    const [onLeave, asking] = [staff[2] ?? staff[0], staff[1] ?? staff[0]];
    const leaveDay = addDays(todayIst, 5);
    await tx`
      insert into staff_leave (staff_id, starts_at, ends_at, reason, status)
      values (${onLeave.id}, ${istInstant(leaveDay, 0)}, ${istInstant(addDays(leaveDay, 1), 0)}, '[demo] Family function', 'approved')`;
    const askDay = addDays(todayIst, 9);
    const [request] = await tx`
      insert into staff_leave (staff_id, starts_at, ends_at, reason, status)
      values (${asking.id}, ${istInstant(askDay, 14 * 60)}, ${istInstant(askDay, 18 * 60)}, '[demo] Doctor appointment', 'requested')
      returning id`;
    await tx`
      insert into notifications (type, title, body, staff_leave_id, dedupe_key)
      values ('leave_requested', ${`Leave request: ${asking.name}`}, 'Doctor appointment', ${request.id}, ${`demo:leave:${request.id}`})`;

    // Real (non-demo) bookings and approved leave block time, so demo rows never clash with them.
    const busy = await tx`
      select staff_id, starts_at, ends_at from bookings
      where status in ('pending', 'confirmed', 'completed')
      union all
      select staff_id, starts_at, ends_at from staff_leave where status = 'approved'`;
    const closed = new Set((await tx`select date::text from salon_closures`).map((r) => r.date));
    const isFree = (staffId, start, end) => !busy.some((x) => x.staff_id === staffId && x.starts_at < end && x.ends_at > start);

    let created = 0;
    const recentOnline = [];
    const rows = { bookings: [], items: [], payments: [], refunds: [] };
    for (let offset = -DAYS_BACK; offset <= DAYS_AHEAD; offset++) {
      const day = addDays(todayIst, offset);
      const wd = weekday(day);
      if (!openDays.has(wd) || closed.has(day)) continue;
      // The past grows steadily towards today (the salon is doing well); the future thins out
      // (people book a few days ahead). Weekends are busier, Tuesdays quieter.
      const weekend = wd === 0 || wd === 6;
      const growth = 0.36 + 0.26 * ((offset + DAYS_BACK) / DAYS_BACK);
      const fill = (offset < 0 ? growth : Math.max(0.18, 0.7 - offset * 0.04)) + (weekend ? 0.12 : wd === 2 ? -0.08 : 0);
      // No-shows fall over time as more clients pay a booking amount online.
      const noShowRate = offset < 0 ? 0.11 - 0.05 * ((offset + DAYS_BACK) / DAYS_BACK) : 0;

      for (const artist of staff) {
        const can = skillsOf(artist.id);
        if (can.length === 0) continue;
        for (const shift of shifts.filter((s) => s.staff_id === artist.id && s.weekday === wd)) {
          let cursor = toMinutes(shift.starts_at) + (chance(0.5) ? 0 : 30);
          const end = toMinutes(shift.ends_at);
          while (cursor < end) {
            // Evenings and lunchtime fill first.
            const hour = Math.floor(cursor / 60);
            const peak = hour >= 17 ? 0.1 : hour >= 12 && hour < 14 ? 0.05 : hour < 12 ? -0.08 : 0;
            if (!chance(fill + peak)) {
              cursor += pick([30, 45, 60]);
              continue;
            }
            const main = pick(can);
            const items = [main];
            if (french && main.id !== french.id && /gel|extension/i.test(main.name) && can.includes(french) && chance(0.3)) items.push(french);
            const minutes = items.reduce((s, i) => s + i.duration_min, 0);
            if (cursor + minutes > end) break;

            const startsAt = istInstant(day, cursor);
            const endsAt = istInstant(day, cursor + minutes);
            if (!isFree(artist.id, startsAt, endsAt)) {
              cursor += 30;
              continue;
            }
            const past = endsAt < now;
            // Online grows over the months; walk-ins only exist for times that have already started.
            const onlineShare = 0.45 + 0.2 * ((offset + DAYS_BACK) / (DAYS_BACK + DAYS_AHEAD));
            const source = chance(onlineShare) ? "online" : startsAt <= now && chance(0.6) ? "walk_in" : "phone";
            const customer = clientFor(offset);
            const total = items.reduce((s, i) => s + i.price_paise, 0);
            const dueNow = source === "online" ? amountDueNow(items) : 0;
            // How far ahead: mostly 1–7 days, some same day, a few planners weeks out.
            const leadHours = chance(0.12) ? 2 + random() * 8 : chance(0.85) ? 20 + random() * 150 : 170 + random() * 400;
            const createdAt =
              source === "walk_in"
                ? new Date(startsAt.getTime() - 10 * 60_000)
                : new Date(Math.min(now.getTime() - 60_000, startsAt.getTime() - leadHours * HOUR));
            let status = past ? (chance(source === "online" ? noShowRate * 0.6 : noShowRate) ? "no_show" : "completed") : "confirmed";
            if (chance(0.045)) status = "cancelled";

            const id = randomUUID();
            const cancelledAt = status === "cancelled" ? new Date(Math.min(now.getTime(), createdAt.getTime() + 2 * HOUR)) : null;
            rows.bookings.push({
              id,
              code: code(),
              customer_id: customer.id,
              customer_email: source === "online" ? customer.email : null,
              staff_id: artist.id,
              starts_at: startsAt,
              ends_at: endsAt,
              status,
              source,
              total_paise: total,
              amount_due_now_paise: dueNow,
              notes: source === "online" && chance(0.2) ? pick(NOTES) : null,
              cancelled_at: cancelledAt,
              cancel_reason: cancelledAt ? "Customer asked to cancel" : null,
              created_by_user_id: source === "online" ? null : (admin?.id ?? null),
              created_at: createdAt,
              updated_at: createdAt,
            });
            for (const [position, item] of items.entries()) {
              rows.items.push({
                booking_id: id,
                service_id: item.id,
                name_snapshot: item.name,
                price_snapshot_paise: item.price_paise,
                duration_snapshot_min: item.duration_min,
                position,
              });
            }
            if (source === "online" && dueNow > 0) {
              // Demo payments: they look real in the admin, but their ids don't exist at Razorpay,
              // so refunding one shows "Refund failed". Use a real test-mode booking to demo refunds.
              const ref = Math.random().toString(36).slice(2, 12);
              const refunded = status === "cancelled";
              const paymentId = randomUUID();
              rows.payments.push({
                id: paymentId,
                booking_id: id,
                rzp_order_id: `order_demo${ref}`,
                rzp_payment_id: `pay_demo${ref}`,
                amount_paise: dueNow,
                status: "captured",
                refunded_paise: refunded ? dueNow : 0,
                created_at: createdAt,
                updated_at: createdAt,
              });
              if (refunded) {
                rows.refunds.push({
                  payment_id: paymentId,
                  booking_id: id,
                  amount_paise: dueNow,
                  status: "processed",
                  rzp_refund_id: `rfnd_demo${ref}`,
                  source: "auto",
                  reason: "Customer cancelled in time",
                  created_at: cancelledAt,
                  updated_at: cancelledAt,
                });
              }
              if (status === "confirmed" && createdAt > new Date(now.getTime() - 48 * HOUR)) recentOnline.push({ id, customer, artist, items, createdAt });
            }
            created++;
            cursor += minutes + pick([0, 0, 15, 30]);
          }
        }
      }
    }

    // Bulk inserts: one statement per 500 rows instead of one per row (the demo DB is remote).
    for (const [table, list] of [["bookings", rows.bookings], ["booking_items", rows.items], ["payments", rows.payments], ["refunds", rows.refunds]]) {
      for (let i = 0; i < list.length; i += 500) await tx`insert into ${tx(table)} ${tx(list.slice(i, i + 500))}`;
    }

    // A few recent "new booking" alerts so the bell has something to show.
    for (const r of recentOnline.slice(-5)) {
      await tx`
        insert into notifications (type, title, body, booking_id, dedupe_key, created_at)
        values ('booking_confirmed', ${`New booking: ${r.customer.name}`}, ${`${r.items.map((i) => i.name).join(", ")} with ${r.artist.name}`},
                ${r.id}, ${`demo:confirmed:${r.id}`}, ${r.createdAt})`;
    }

    console.log(`✓ Demo data: ${created} bookings over ${DAYS_BACK + DAYS_AHEAD + 1} days, ${CUSTOMERS} customers, leave and alerts.`);
  });
} finally {
  await sql.end();
}
