import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import { authSchemaOptions } from "./auth-schema";
import { env } from "./env";

/**
 * Admin and staff authentication (AGENTS.md §8). Database sessions in our Postgres with
 * httpOnly cookies. Customers never log in. There is no public sign-up: the owner is created with
 * `npm run admin:create-user`, and the owner creates everyone else.
 *
 * Better Auth talks to Postgres through `pg`; the rest of the app uses postgres.js (lib/db.ts).
 */

const globalForAuth = globalThis as unknown as { daybookAuthPool?: Pool };
const pool = globalForAuth.daybookAuthPool ?? new Pool({ connectionString: env.DATABASE_URL, max: 5 });
if (env.NODE_ENV !== "production") globalForAuth.daybookAuthPool = pool;

export const auth = betterAuth({
  appName: "Daybook",
  baseURL: env.SITE_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: pool,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    autoSignIn: false,
    minPasswordLength: 10,
  },
  user: authSchemaOptions.user,
  account: authSchemaOptions.account,
  verification: authSchemaOptions.verification,
  session: {
    ...authSchemaOptions.session,
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refreshed at most daily
  },
  rateLimit: {
    ...authSchemaOptions.rateLimit,
    enabled: true,
    window: 60,
    max: 100,
    // Brute-force protection on login: 5 attempts per minute per IP.
    customRules: { "/sign-in/email": { window: 60, max: 5 } },
  },
  advanced: authSchemaOptions.advanced,
  databaseHooks: {
    session: {
      create: {
        // Deactivated users (e.g. a technician who left) can't start a session.
        before: async (session) => {
          const { rows } = await pool.query<{ active: boolean }>("select active from users where id = $1", [session.userId]);
          return rows[0]?.active === true;
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
