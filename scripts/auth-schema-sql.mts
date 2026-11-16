// Prints the SQL Better Auth expects for our schema options, compared with the dev database.
// Use it to write dbmate migrations after a Better Auth upgrade:  npm run auth:schema
// It never changes the database.
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { authSchemaOptions } from "../lib/auth-schema.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (expected in .env.local).");

const pool = new Pool({ connectionString: url.replace("?sslmode=disable", "") });
try {
  const { compileMigrations, schemaProblems } = await getMigrations({
    database: pool,
    emailAndPassword: { enabled: true },
    // Spread a mutable copy: Better Auth's option types aren't readonly.
    ...(structuredClone(authSchemaOptions) as Record<string, unknown>),
  });
  if (schemaProblems.length) console.error("Schema problems:\n" + schemaProblems.join("\n"));
  const sql = await compileMigrations();
  const trimmed = sql.trim().replace(/^;$/, "");
  console.log(trimmed || "-- Nothing to change: the database already matches Better Auth's schema.");
} finally {
  await pool.end();
}
