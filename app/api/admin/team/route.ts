import { adminRoute, OWNER_ONLY } from "@/server/admin/http";
import { teamCreateSchema } from "@/server/admin/schemas";
import { createTeamMember } from "@/server/admin/team";

export const POST = adminRoute({ roles: OWNER_ONLY, body: teamCreateSchema }, ({ body }) => createTeamMember(body));
