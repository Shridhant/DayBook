import { adminRoute, OWNER_ONLY } from "@/server/admin/http";
import { skillsSchema } from "@/server/admin/schemas";
import { setStaffSkills } from "@/server/admin/staff-admin";

export const PUT = adminRoute({ roles: OWNER_ONLY, body: skillsSchema }, ({ body, params }) => setStaffSkills(params.id, body.serviceIds));
