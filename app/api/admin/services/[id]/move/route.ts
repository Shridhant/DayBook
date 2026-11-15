import { adminRoute, OWNER_ONLY } from "@/server/admin/http";
import { moveSchema } from "@/server/admin/schemas";
import { moveService } from "@/server/admin/services-admin";

export const POST = adminRoute({ roles: OWNER_ONLY, body: moveSchema }, ({ body, params }) => moveService(params.id, body.direction));
