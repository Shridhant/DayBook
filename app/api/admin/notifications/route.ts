import { FRONT_DESK, adminRoute } from "@/server/admin/http";
import { listNotifications } from "@/server/admin/notifications-admin";

/** GET /api/admin/notifications → { unread, items } for the signed-in person. Polled by the bell. */
export const GET = adminRoute({ roles: FRONT_DESK }, async ({ user }) =>
  Response.json(await listNotifications(user.id), { headers: { "Cache-Control": "no-store" } }),
);
