import { createPortfolioItem } from "@/server/admin/content-admin";
import { adminRoute, FRONT_DESK } from "@/server/admin/http";
import { portfolioCreateSchema } from "@/server/admin/schemas";

export const POST = adminRoute({ roles: FRONT_DESK, body: portfolioCreateSchema }, ({ body: { image, ...rest } }) => createPortfolioItem(image, rest));
