import { z } from "zod";
import { FRONT_DESK, adminRoute } from "@/server/admin/http";
import { markNotificationsRead } from "@/server/admin/notifications-admin";

const bodySchema = z.union([z.object({ all: z.literal(true) }), z.object({ ids: z.array(z.uuid()).min(1).max(100) })]);

/** POST /api/admin/notifications/read  { all: true } | { ids: [...] } */
export const POST = adminRoute({ roles: FRONT_DESK, body: bodySchema }, ({ user, body }) =>
  markNotificationsRead(user.id, "all" in body ? "all" : body.ids),
);
