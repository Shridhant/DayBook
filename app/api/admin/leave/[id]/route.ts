import { adminRoute, FRONT_DESK } from "@/server/admin/http";
import { leaveDecisionSchema } from "@/server/admin/schemas";
import { decideLeave, deleteLeave } from "@/server/admin/staff-admin";

export const DELETE = adminRoute({ roles: FRONT_DESK }, ({ params }) => deleteLeave(params.id));

/** Approve or decline a technician's request. Returns { saved: false, clashes } first if approving overlaps bookings. */
export const PATCH = adminRoute({ roles: FRONT_DESK, body: leaveDecisionSchema }, ({ body, params, user }) =>
  decideLeave(params.id, body, user.id),
);
