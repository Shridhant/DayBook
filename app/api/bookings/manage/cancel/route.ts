import { sendQueuedEmailsSoon } from "@/server/email";
import { cancelByCustomer } from "@/server/manage-booking";
import { invalidRequest, manageAuthSchema, manageErrorResponse, noStore } from "@/server/manage-http";
import { clientIp, hitRateLimit, LIMITS, tooManyRequests } from "@/server/rate-limit";

/** POST /api/bookings/manage/cancel { code, key } — the customer cancels; refunds automatically if in time. */
export async function POST(request: Request) {
  const limited = await hitRateLimit(`manage:ip:${clientIp(request)}`, LIMITS.managePerIp);
  if (!limited.allowed) return tooManyRequests(limited);

  const parsed = manageAuthSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidRequest(parsed.error.issues[0]?.message);

  try {
    const result = await cancelByCustomer(parsed.data.code, parsed.data.key);
    sendQueuedEmailsSoon();
    return Response.json(result, { headers: noStore });
  } catch (error) {
    return manageErrorResponse(error);
  }
}
