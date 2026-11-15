import { adminRoute, OWNER_ONLY } from "@/server/admin/http";
import { shiftsSchema } from "@/server/admin/schemas";
import { setStaffShifts } from "@/server/admin/staff-admin";

/** Returns { saved: false, clashes } when bookings would fall outside the new hours (resend with force). */
export const PUT = adminRoute({ roles: OWNER_ONLY, body: shiftsSchema }, ({ body, params }) => setStaffShifts(params.id, body.shifts, body.force));
