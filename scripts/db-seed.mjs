// Loads db/seed.sql into the LOCAL dev database as the schema owner.
// Refuses to run in production or against a non-local host.
import postgres from "postgres";

const url = process.env.DATABASE_MIGRATION_URL;
if (!url) {
  console.error("DATABASE_MIGRATION_URL is not set (expected in .env.local).");
  process.exit(1);
}
const host = new URL(url).hostname;
if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Refusing to seed: NODE_ENV=${process.env.NODE_ENV ?? "unset"}, host=${host}. Seeding is local-only.`);
  process.exit(1);
}

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
