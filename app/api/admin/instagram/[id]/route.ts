import { deleteInstagramPost, updateInstagramPost } from "@/server/admin/content-admin";
import { adminRoute, FRONT_DESK } from "@/server/admin/http";
import { instagramSchema } from "@/server/admin/schemas";

export const PATCH = adminRoute({ roles: FRONT_DESK, body: instagramSchema }, ({ body, params }) => updateInstagramPost(params.id, body));
export const DELETE = adminRoute({ roles: FRONT_DESK }, ({ params }) => deleteInstagramPost(params.id));
