import { adminRoute, OWNER_ONLY } from "@/server/admin/http";
import { passwordSchema } from "@/server/admin/schemas";
import { resetTeamPassword } from "@/server/admin/team";

export const POST = adminRoute({ roles: OWNER_ONLY, body: passwordSchema }, ({ body, params, user }) => resetTeamPassword(user.id, params.id, body.password));
