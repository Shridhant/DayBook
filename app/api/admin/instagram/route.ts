import { createInstagramPost } from "@/server/admin/content-admin";
import { adminRoute, FRONT_DESK } from "@/server/admin/http";
import { instagramSchema } from "@/server/admin/schemas";

export const POST = adminRoute({ roles: FRONT_DESK, body: instagramSchema }, ({ body: body }) => createInstagramPost(body));
