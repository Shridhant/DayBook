import { adminRoute, OWNER_ONLY } from "@/server/admin/http";
import { categorySchema } from "@/server/admin/schemas";
import { createCategory } from "@/server/admin/services-admin";

export const POST = adminRoute({ roles: OWNER_ONLY, body: categorySchema }, ({ body }) => createCategory(body.name));
