// Creates an admin user (there is no public sign-up).
//
//   npm run admin:create-user -- --role owner --name "Priya Sharma" --email priya@example.com
//
// You'll be asked for the password twice (input is hidden). Roles: owner | receptionist | staff.
// Local development only: `--password-env NAME` reads the password from that env variable instead.
// `--url-env NAME` creates the user in another database, e.g. SUPABASE_APP_URL for the hosted demo.
import { betterAuth } from "better-auth";
import { parseArgs } from "node:util";
import { Pool } from "pg";
import { authSchemaOptions, STAFF_ROLES, type StaffRole } from "../lib/auth-schema.ts";

const { values } = parseArgs({
  options: {
    role: { type: "string", default: "owner" },
    name: { type: "string" },
    email: { type: "string" },
    "password-env": { type: "string" },
    "url-env": { type: "string", default: "DATABASE_URL" },
  },
});

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const role = values.role as StaffRole;
if (!STAFF_ROLES.includes(role)) fail(`--role must be one of: ${STAFF_ROLES.join(", ")}`);
const name = values.name?.trim() ?? "";
if (name.length < 2) fail('--name is required, e.g. --name "Priya Sharma"');
const email = values.email?.trim().toLowerCase() ?? "";
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("--email must be a valid email address");

const urlEnv = values["url-env"] ?? "DATABASE_URL";
const url = process.env[urlEnv];
if (!url) fail(`${urlEnv} is not set (expected in .env.local).`);

/** Reads a line from the terminal without echoing it. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) fail("Run this in an interactive terminal (or use --password-env for local dev).");
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let input = "";
    const onData = (char: string) => {
      if (char === "\r" || char === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(input);
      } else if (char === "\u0003") {
        process.exit(130); // Ctrl+C
      } else if (char === "\u007f") {
        input = input.slice(0, -1);
      } else {
        input += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function readPassword(): Promise<string> {
  const fromEnv = values["password-env"];
  if (fromEnv) {
    const host = new URL(url ?? "").hostname;
    if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "::1"].includes(host)) {
      fail("--password-env is for local development only.");
    }
    return process.env[fromEnv] ?? fail(`Environment variable ${fromEnv} is not set.`);
  }
  const first = await promptHidden("Password (min 10 characters): ");
  const second = await promptHidden("Repeat password: ");
  if (first !== second) fail("Passwords don't match.");
  return first;
}

const password = await readPassword();
if (password.length < 10) fail("Password must be at least 10 characters.");

const pool = new Pool({ connectionString: url });
try {
  const existing = await pool.query("select 1 from users where email = $1", [email]);
  if (existing.rowCount) fail(`A user with email ${email} already exists.`);

  const auth = betterAuth({
    database: pool,
    emailAndPassword: { enabled: true },
    ...(structuredClone(authSchemaOptions) as Record<string, unknown>),
  });
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser({ name, email, emailVerified: true, role, active: true }, { method: "admin" });
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await ctx.password.hash(password),
  });
  console.log(`✓ Created ${role} ${name} <${email}>. Sign in at /admin/login.`);
} finally {
  await pool.end();
}
