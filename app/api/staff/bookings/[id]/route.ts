import { staffRoute } from "@/server/admin/http";
import { staffActionSchema } from "@/server/admin/schemas";
import { applyStaffAction } from "@/server/staff-portal";

/** POST /api/staff/bookings/:id { action } — a technician marks their own booking done / no-show, or undoes it. */
export const POST = staffRoute({ body: staffActionSchema }, ({ body, params, user }) => applyStaffAction(user.staffId, params.id, body.action));
