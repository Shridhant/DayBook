import { adminRoute, FRONT_DESK } from "@/server/admin/http";
import { deleteLeave } from "@/server/admin/staff-admin";

export const DELETE = adminRoute({ roles: FRONT_DESK }, ({ params }) => deleteLeave(params.id));
