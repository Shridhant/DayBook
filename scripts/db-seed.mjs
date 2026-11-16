// Loads db/seed.sql (catalog, artists, shifts, sample content) as the schema owner. It WIPES the
// catalog, bookings and content tables first, so only use it on a dev or demo database.
// Local by default; a remote database must be named with --url-env.
import postgres from "postgres";

// `--url-env NAME` targets another database (e.g. SUPABASE_MIGRATION_URL for the hosted demo);
// anything that isn't localhost must be named explicitly like that, never by accident.
const urlFlag = process.argv.indexOf("--url-env");
const urlEnv = urlFlag > -1 ? process.argv[urlFlag + 1] : "DATABASE_MIGRATION_URL";
const url = process.env[urlEnv];
if (!url) {
  console.error(`${urlEnv} is not set (expected in .env.local).`);
  process.exit(1);
}
const host = new URL(url).hostname;
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
if (!isLocal) console.log(`→ Seeding the REMOTE database at ${host} (from ${urlEnv}).`);
if (process.env.NODE_ENV === "production" || (!isLocal && urlFlag === -1)) {
  console.error(`Refusing to seed: NODE_ENV=${process.env.NODE_ENV ?? "unset"}, host=${host}. Use --url-env for a remote demo database.`);
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
