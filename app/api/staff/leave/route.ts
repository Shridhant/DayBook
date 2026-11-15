import { staffRoute } from "@/server/admin/http";
import { staffLeaveRequestSchema } from "@/server/admin/schemas";
import { requestLeave } from "@/server/staff-portal";

/** POST /api/staff/leave — a technician asks for time off; the front desk approves it in the admin. */
export const POST = staffRoute({ body: staffLeaveRequestSchema }, ({ body, user }) => requestLeave(user, body));
