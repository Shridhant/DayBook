import { adminRoute, OWNER_ONLY } from "@/server/admin/http";
import { categoryUpdateSchema } from "@/server/admin/schemas";
import { deleteCategory, updateCategory } from "@/server/admin/services-admin";

export const PATCH = adminRoute({ roles: OWNER_ONLY, body: categoryUpdateSchema }, ({ body, params }) => updateCategory(params.id, body));
export const DELETE = adminRoute({ roles: OWNER_ONLY }, ({ params }) => deleteCategory(params.id));
