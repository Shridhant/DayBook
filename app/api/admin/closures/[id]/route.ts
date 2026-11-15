import { adminRoute, FRONT_DESK } from "@/server/admin/http";
import { deleteClosure } from "@/server/admin/settings-admin";

export const DELETE = adminRoute({ roles: FRONT_DESK }, ({ params }) => deleteClosure(params.id));
