import "server-only";
import postgres from "postgres";
import { env } from "./env";

/**
 * Shared postgres.js pool (AGENTS.md §6). Connects as the app role (row read/write only).
 * Cached on globalThis in development so hot reloads don't open a new pool each time.
 *
 * Usage:  const rows = await sql`select * from services where active = ${true}`
 * Values inside ${} are sent as parameters; never build SQL by string concatenation.
 */
function createPool() {
  return postgres(env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { application_name: "daybook-web", timezone: "UTC" },
    onnotice: () => {},
  });
}

const globalForDb = globalThis as unknown as { daybookSql?: ReturnType<typeof createPool> };

export const sql = globalForDb.daybookSql ?? createPool();

if (env.NODE_ENV !== "production") globalForDb.daybookSql = sql;
