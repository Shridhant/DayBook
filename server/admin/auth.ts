import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import type { StaffRole } from "@/lib/auth-schema";

/**
 * Data Access Layer for admin identity (AGENTS.md §8). Every admin page and admin API route calls
 * one of these; proxy.ts redirects are only a convenience.
 */

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  staffId: string | null;
};

/** Roles allowed into the admin panel. Technicians ("staff") use the staff portal at /staff. */
export const ADMIN_ROLES: StaffRole[] = ["owner", "receptionist"];

function toAdminUser(user: Record<string, unknown> | undefined | null): AdminUser | null {
  if (!user || user.active !== true) return null;
  return {
    id: String(user.id),
    name: String(user.name),
    email: String(user.email),
    role: user.role as StaffRole,
    staffId: (user.staffId as string | null | undefined) ?? null,
  };
}

/** The signed-in user for this request, or null. Deduplicated per request. Reads cookies, so call it inside <Suspense>. */
export const getCurrentUser = cache(async (): Promise<AdminUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  return toAdminUser(session?.user);
});

/** For pages: redirects to login (or the forbidden page) instead of returning. */
export async function requirePageUser(roles: StaffRole[] = ADMIN_ROLES): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (!roles.includes(user.role)) redirect(user.role === "staff" ? "/staff" : "/admin/forbidden");
  return user;
}

/** A technician signed in to the staff portal, always linked to their artist profile. */
export type StaffUser = AdminUser & { staffId: string };

/** For staff portal pages. The owner and front desk are sent to the admin; an unlinked login sees the no-access page. */
export async function requireStaffPageUser(): Promise<StaffUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login?next=/staff");
  if (user.role !== "staff") redirect("/admin");
  if (!user.staffId) redirect("/admin/forbidden");
  return { ...user, staffId: user.staffId };
}

/**
 * For route handlers: returns the user, or a 401/403 Response to return as-is.
 *   const user = await requireApiUser(request, ["owner"]);
 *   if (user instanceof Response) return user;
 */
export async function requireApiUser(request: Request, roles: StaffRole[] = ADMIN_ROLES): Promise<AdminUser | Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = toAdminUser(session?.user);
  if (!user) return Response.json({ error: "unauthorized", message: "Please sign in again." }, { status: 401 });
  if (!roles.includes(user.role)) {
    return Response.json({ error: "forbidden", message: "You don't have permission to do that." }, { status: 403 });
  }
  return user;
}
