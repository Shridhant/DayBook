import { adminRoute, FRONT_DESK } from "@/server/admin/http";
import { closureSchema } from "@/server/admin/schemas";
import { addClosure } from "@/server/admin/settings-admin";

/** Returns { saved: false, clashes } when bookings exist that day (resend with force). */
export const POST = adminRoute({ roles: FRONT_DESK, body: closureSchema }, ({ body }) => addClosure(body.date, body.reason ?? undefined, body.force));
