import { adminRoute, OWNER_ONLY } from "@/server/admin/http";
import { hoursSchema } from "@/server/admin/schemas";
import { setOpeningHours } from "@/server/admin/settings-admin";

export const PUT = adminRoute({ roles: OWNER_ONLY, body: hoursSchema }, ({ body }) => setOpeningHours(body.hours));
