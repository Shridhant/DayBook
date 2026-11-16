// Fills the LOCAL dev database with realistic demo activity around today, so the admin calendar,
// bookings list, staff portal and notifications look like a busy salon during a pitch.
//
// Re-runnable: removes only what it created before (customers with phones 99999xxxxx, which no
// real Indian number uses here) and never touches other bookings. Run `npm run db:seed` first for
// the catalog and artists. Refuses to run in production or against a non-local host.
import postgres from "postgres";

const url = process.env.DATABASE_MIGRATION_URL;
if (!url) {
  console.error("DATABASE_MIGRATION_URL is not set (expected in .env.local).");
  process.exit(1);
}
const host = new URL(url).hostname;
if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Refusing to write demo data: NODE_ENV=${process.env.NODE_ENV ?? "unset"}, host=${host}. Local only.`);
  process.exit(1);
}

const DAYS_BACK = 14;
const DAYS_AHEAD = 14;
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
      await tx`delete from email_outbox where ${tx.unsafe(ids.map((id) => `dedupe_key like '%${id}%'`).join(" or "))}`;
      await tx`delete from refunds where booking_id in ${tx(ids)}`;
      await tx`delete from payments where booking_id in ${tx(ids)}`;
      await tx`delete from booking_items where booking_id in ${tx(ids)}`;
      await tx`delete from bookings where id in ${tx(ids)}`;
    }
    await tx`delete from customers where phone like ${`${PHONE_PREFIX}%`}`;
    await tx`delete from staff_leave where reason like '[demo]%'`;
    await tx`delete from notifications where dedupe_key like 'demo:%'`;

    // ~60 regulars, so some customers come back more than once.
    const customers = [];
    for (let i = 0; i < 60; i++) {
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      const email = chance(0.75) ? `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com` : null;
      const [c] = await tx`
        insert into customers (name, phone, email) values (${name}, ${`${PHONE_PREFIX}${String(i + 1).padStart(5, "0")}`}, ${email})
        returning id, name, email`;
      customers.push(c);
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
    for (let offset = -DAYS_BACK; offset <= DAYS_AHEAD; offset++) {
      const day = addDays(todayIst, offset);
      const wd = weekday(day);
      if (!openDays.has(wd) || closed.has(day)) continue;
      // Busy near today, thinner further ahead (people book a few days out); weekends busier.
      const weekend = wd === 0 || wd === 6;
      const fill = offset < 0 ? 0.62 : Math.max(0.18, 0.7 - offset * 0.04) + (weekend ? 0.12 : 0);

      for (const artist of staff) {
        const can = skillsOf(artist.id);
        if (can.length === 0) continue;
        for (const shift of shifts.filter((s) => s.staff_id === artist.id && s.weekday === wd)) {
          let cursor = toMinutes(shift.starts_at) + (chance(0.5) ? 0 : 30);
          const end = toMinutes(shift.ends_at);
          while (cursor < end) {
            if (!chance(fill)) {
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
            // Walk-ins only exist for times that have already started.
            const source = chance(0.6) ? "online" : startsAt <= now && chance(0.6) ? "walk_in" : "phone";
            const customer = pick(customers);
            const total = items.reduce((s, i) => s + i.price_paise, 0);
            const dueNow = source === "online" ? amountDueNow(items) : 0;
            const createdAt =
              source === "walk_in" ? new Date(startsAt.getTime() - 10 * 60_000) : new Date(startsAt.getTime() - (6 + Math.floor(random() * 120)) * HOUR);
            let status = past ? (chance(0.9) ? "completed" : "no_show") : "confirmed";
            if (chance(0.05)) status = "cancelled";

            const [b] = await tx`
              insert into bookings (code, customer_id, staff_id, starts_at, ends_at, status, source, total_paise, amount_due_now_paise,
                                    notes, cancelled_at, cancel_reason, created_by_user_id, created_at, updated_at)
              values (${code()}, ${customer.id}, ${artist.id}, ${startsAt}, ${endsAt}, ${status}, ${source}, ${total}, ${dueNow},
                      ${source === "online" && chance(0.2) ? pick(NOTES) : null},
                      ${status === "cancelled" ? new Date(Math.min(now.getTime(), createdAt.getTime() + 2 * HOUR)) : null},
                      ${status === "cancelled" ? "Customer asked to cancel" : null},
                      ${source === "online" ? null : admin?.id ?? null}, ${createdAt}, ${createdAt})
              returning id`;
            for (const [position, item] of items.entries()) {
              await tx`
                insert into booking_items (booking_id, service_id, name_snapshot, price_snapshot_paise, duration_snapshot_min, position)
                values (${b.id}, ${item.id}, ${item.name}, ${item.price_paise}, ${item.duration_min}, ${position})`;
            }
            if (source === "online" && dueNow > 0) {
              // Demo payments: they look real in the admin, but their ids don't exist at Razorpay,
              // so refunding one shows "Refund failed". Use a real test-mode booking to demo refunds.
              const ref = Math.random().toString(36).slice(2, 12);
              const cancelledRefunded = status === "cancelled";
              const [p] = await tx`
                insert into payments (booking_id, rzp_order_id, rzp_payment_id, amount_paise, status, refunded_paise, created_at, updated_at)
                values (${b.id}, ${`order_demo${ref}`}, ${`pay_demo${ref}`}, ${dueNow}, 'captured', ${cancelledRefunded ? dueNow : 0}, ${createdAt}, ${createdAt})
                returning id`;
              if (cancelledRefunded) {
                await tx`
                  insert into refunds (payment_id, booking_id, amount_paise, status, rzp_refund_id, source, reason, created_at, updated_at)
                  values (${p.id}, ${b.id}, ${dueNow}, 'processed', ${`rfnd_demo${ref}`}, 'auto', 'Customer cancelled in time', ${createdAt}, ${createdAt})`;
              }
              if (status === "confirmed" && createdAt > new Date(now.getTime() - 48 * HOUR)) recentOnline.push({ id: b.id, customer, artist, items, createdAt });
            }
            created++;
            cursor += minutes + pick([0, 0, 15, 30]);
          }
        }
      }
    }

    // A few recent "new booking" alerts so the bell has something to show.
    for (const r of recentOnline.slice(-5)) {
      await tx`
        insert into notifications (type, title, body, booking_id, dedupe_key, created_at)
        values ('booking_confirmed', ${`New booking: ${r.customer.name}`}, ${`${r.items.map((i) => i.name).join(", ")} with ${r.artist.name}`},
                ${r.id}, ${`demo:confirmed:${r.id}`}, ${r.createdAt})`;
    }

    console.log(`✓ Demo data: ${created} bookings over ${DAYS_BACK + DAYS_AHEAD + 1} days, 60 customers, leave and alerts.`);
  });
} finally {
  await sql.end();
}
