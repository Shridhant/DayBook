import { adminRoute, OWNER_ONLY } from "@/server/admin/http";
import { staffUpdateSchema } from "@/server/admin/schemas";
import { updateStaffProfile } from "@/server/admin/staff-admin";

export const PATCH = adminRoute({ roles: OWNER_ONLY, body: staffUpdateSchema }, ({ body, params }) => updateStaffProfile(params.id, body));
