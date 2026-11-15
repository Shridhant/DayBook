import { adminRoute, OWNER_ONLY } from "@/server/admin/http";
import { settingsSchema } from "@/server/admin/schemas";
import { updateSettings } from "@/server/admin/settings-admin";

export const PUT = adminRoute({ roles: OWNER_ONLY, body: settingsSchema }, ({ body: { bookingAmountFixed, ...rest } }) =>
  updateSettings({ ...rest, bookingAmountFixedPaise: bookingAmountFixed }),
);
