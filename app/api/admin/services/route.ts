import { adminRoute, OWNER_ONLY } from "@/server/admin/http";
import { serviceSchema } from "@/server/admin/schemas";
import { createService } from "@/server/admin/services-admin";

export const POST = adminRoute({ roles: OWNER_ONLY, body: serviceSchema }, ({ body: { price, bookingAmountOverride, ...rest } }) =>
  createService({ ...rest, pricePaise: price, bookingAmountOverridePaise: bookingAmountOverride }),
);
