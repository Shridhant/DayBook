import { adminRoute, OWNER_ONLY } from "@/server/admin/http";
import { categorySchema } from "@/server/admin/schemas";
import { deleteCategory, updateCategory } from "@/server/admin/services-admin";

export const PATCH = adminRoute({ roles: OWNER_ONLY, body: categorySchema }, ({ body, params }) => updateCategory(params.id, { name: body.name }));
export const DELETE = adminRoute({ roles: OWNER_ONLY }, ({ params }) => deleteCategory(params.id));
