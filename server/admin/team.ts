import "server-only";
import { auth } from "@/lib/auth";
import type { StaffRole } from "@/lib/auth-schema";
import { sql } from "@/lib/db";
import { AdminError, notFound } from "./http";
import { checkTeamChange } from "./rules";

/**
 * Team logins (owner only). Uses Better Auth's own context so passwords are hashed exactly as the
 * login expects. Deactivating someone or resetting their password signs them out everywhere.
 */

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  staffId: string | null;
  staffName: string | null;
  lastActiveAt: string | null;
};

export async function listTeam(): Promise<TeamMember[]> {
  return sql<TeamMember[]>`
    select u.id, u.name, u.email, u.role, u.active, u.staff_id as "staffId", st.name as "staffName",
           (select to_json(max(s.updated_at)) #>> '{}' from sessions s where s.user_id = u.id) as "lastActiveAt"
    from users u left join staff st on st.id = u.staff_id
    order by u.active desc, case u.role when 'owner' then 0 when 'receptionist' then 1 else 2 end, u.name`;
}

async function assertStaffLink(role: StaffRole, staffId: string | null | undefined, userId?: string) {
  if (role !== "staff" || !staffId) return;
  const [staff] = await sql`select 1 from staff where id = ${staffId}`;
  if (!staff) throw new AdminError(400, "invalid_request", "Choose an artist to link.", "staffId");
  const [taken] = await sql`select 1 from users where staff_id = ${staffId} ${userId ? sql`and id <> ${userId}` : sql``}`;
  if (taken) throw new AdminError(409, "staff_linked", "That artist already has a login.", "staffId");
}

export async function createTeamMember(input: { name: string; email: string; role: StaffRole; password: string; staffId?: string | null }) {
  const email = input.email.trim().toLowerCase();
  const [existing] = await sql`select 1 from users where email = ${email}`;
  if (existing) throw new AdminError(409, "email_taken", "Someone already uses that email.", "email");
  await assertStaffLink(input.role, input.staffId);

  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { name: input.name, email, emailVerified: true, role: input.role, active: true, staffId: input.role === "staff" ? input.staffId ?? null : null },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await ctx.password.hash(input.password),
  });
  return { id: user.id };
}

export async function updateTeamMember(
  actorId: string,
  id: string,
  input: { name?: string; role?: StaffRole; active?: boolean; staffId?: string | null },
) {
  const [target] = await sql<{ id: string; role: StaffRole; active: boolean; staff_id: string | null }[]>`
    select id, role, active, staff_id from users where id = ${id}`;
  if (!target) throw notFound("Team member");
  const [{ owners }] = await sql<{ owners: number }[]>`select count(*)::int as owners from users where role = 'owner' and active`;

  const problem = checkTeamChange({
    actorId,
    target: { id: target.id, role: target.role, active: target.active },
    change: { role: input.role, active: input.active },
    activeOwnerCount: owners,
  });
  if (problem) throw new AdminError(409, "not_allowed", problem);

  const role = input.role ?? target.role;
  const staffId = role === "staff" ? (input.staffId === undefined ? target.staff_id : input.staffId) : null;
  await assertStaffLink(role, staffId, id);

  await sql`
    update users set name = coalesce(${input.name ?? null}, name), role = ${role}, staff_id = ${staffId},
      active = coalesce(${input.active ?? null}, active), updated_at = now()
    where id = ${id}`;

  if (input.active === false) await (await auth.$context).internalAdapter.deleteUserSessions(id);
}

export async function resetTeamPassword(actorId: string, id: string, password: string) {
  const [target] = await sql`select 1 from users where id = ${id}`;
  if (!target) throw notFound("Team member");
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);
  const [updated] = await sql`
    update accounts set password = ${hash}, updated_at = now() where user_id = ${id} and provider_id = 'credential' returning id`;
  if (!updated) await ctx.internalAdapter.linkAccount({ userId: id, providerId: "credential", accountId: id, password: hash });
  // Everyone else is signed out; resetting your own password keeps this session.
  if (id !== actorId) await ctx.internalAdapter.deleteUserSessions(id);
}
