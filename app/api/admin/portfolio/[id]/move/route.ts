import { moveContent } from "@/server/admin/content-admin";
import { adminRoute, FRONT_DESK } from "@/server/admin/http";
import { moveSchema } from "@/server/admin/schemas";

export const POST = adminRoute({ roles: FRONT_DESK, body: moveSchema }, ({ body, params }) => moveContent("portfolio_items", params.id, body.direction));
