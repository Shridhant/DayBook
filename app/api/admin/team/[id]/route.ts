import { adminRoute, OWNER_ONLY } from "@/server/admin/http";
import { teamUpdateSchema } from "@/server/admin/schemas";
import { updateTeamMember } from "@/server/admin/team";

export const PATCH = adminRoute({ roles: OWNER_ONLY, body: teamUpdateSchema }, ({ body, params, user }) => updateTeamMember(user.id, params.id, body));
