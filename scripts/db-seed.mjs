// Loads db/seed.sql (catalog, artists, shifts, sample content). It WIPES the catalog, bookings
// and content tables first, so on any non-local database (e.g. the Supabase demo) it asks for an
// explicit `npm run db:seed -- --yes`. Never for a real salon's database.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (expected in .env.local).");
  process.exit(1);
}
const host = new URL(url).hostname;
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed with NODE_ENV=production.");
  process.exit(1);
}
if (!isLocal && !process.argv.includes("--yes")) {
  console.error(`This wipes services, artists, bookings and content on ${host}.\nIf that's what you want (fresh demo database), run: npm run db:seed -- --yes`);
  process.exit(1);
}
console.log(`→ Seeding ${host}`);

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql.file(new URL("../db/seed.sql", import.meta.url).pathname);
  const [{ services, staff, shifts }] = await sql`
    select (select count(*) from services)::int as services,
           (select count(*) from staff)::int as staff,
           (select count(*) from staff_shifts)::int as shifts`;
  console.log(`✓ Seeded ${services} services, ${staff} staff, ${shifts} shifts.`);
} finally {
  await sql.end();
}
