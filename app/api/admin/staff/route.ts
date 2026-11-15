import { adminRoute, OWNER_ONLY } from "@/server/admin/http";
import { staffCreateSchema } from "@/server/admin/schemas";
import { createStaff } from "@/server/admin/staff-admin";

export const POST = adminRoute({ roles: OWNER_ONLY, body: staffCreateSchema }, ({ body }) =>
  createStaff({ name: body.name, specialties: body.specialties ?? undefined, bio: body.bio ?? undefined }),
);
