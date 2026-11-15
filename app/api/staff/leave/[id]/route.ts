import { staffRoute } from "@/server/admin/http";
import { withdrawLeave } from "@/server/staff-portal";

/** DELETE /api/staff/leave/:id — withdraw a request that hasn't been answered yet. */
export const DELETE = staffRoute({}, ({ params, user }) => withdrawLeave(user.staffId, params.id));
