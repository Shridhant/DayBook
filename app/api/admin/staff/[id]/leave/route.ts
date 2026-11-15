import { adminRoute, FRONT_DESK } from "@/server/admin/http";
import { leaveSchema } from "@/server/admin/schemas";
import { addLeave } from "@/server/admin/staff-admin";

/** Returns { saved: false, clashes } when the leave overlaps bookings (resend with force). */
export const POST = adminRoute({ roles: FRONT_DESK, body: leaveSchema }, ({ body, params }) => {
  const { force, reason, ...range } = body;
  return addLeave(params.id, { ...range, reason: reason ?? undefined }, force);
});
