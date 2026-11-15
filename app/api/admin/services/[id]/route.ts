import { adminRoute, OWNER_ONLY } from "@/server/admin/http";
import { serviceSchema } from "@/server/admin/schemas";
import { deleteService, updateService } from "@/server/admin/services-admin";

export const PUT = adminRoute({ roles: OWNER_ONLY, body: serviceSchema }, ({ body: { price, bookingAmountOverride, ...rest }, params }) =>
  updateService(params.id, { ...rest, pricePaise: price, bookingAmountOverridePaise: bookingAmountOverride }),
);
export const DELETE = adminRoute({ roles: OWNER_ONLY }, ({ params }) => deleteService(params.id));
