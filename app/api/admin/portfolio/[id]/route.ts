import { deletePortfolioItem, updatePortfolioItem } from "@/server/admin/content-admin";
import { adminRoute, FRONT_DESK } from "@/server/admin/http";
import { portfolioSchema } from "@/server/admin/schemas";

export const PATCH = adminRoute({ roles: FRONT_DESK, body: portfolioSchema }, ({ body, params }) => updatePortfolioItem(params.id, body));
export const DELETE = adminRoute({ roles: FRONT_DESK }, ({ params }) => deletePortfolioItem(params.id));
