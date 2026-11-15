import "server-only";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import type { StaffRole } from "@/lib/auth-schema";
import { AvailabilityError } from "../availability-query";
import { isPgError } from "../booking-insert";
import { CATALOG_TAG } from "../catalog";
import { CONTENT_TAG } from "../content";
import { requireApiUser, type AdminUser, type StaffUser } from "./auth";

/**
 * Shared plumbing for admin route handlers: role check, zod body parsing, consistent errors.
 * Route handlers stay thin (AGENTS.md §11): parse → authorise → call domain → respond.
 */

/** Who may do what (decided by the owner, 2026-11-16). */
export const OWNER_ONLY: StaffRole[] = ["owner"];
export const FRONT_DESK: StaffRole[] = ["owner", "receptionist"];

export class AdminError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly field?: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Item") => new AdminError(404, "not_found", `${what} not found.`);

type Handler<B> = (args: { request: Request; user: AdminUser; body: B; params: Record<string, string> }) => Promise<unknown>;

export function adminRoute<B = undefined>(
  options: { roles: StaffRole[]; body?: z.ZodType<B> },
  handler: Handler<B>,
) {
  return async (request: Request, ctx?: { params: Promise<Record<string, string | string[]> | undefined> }) => {
    const user = await requireApiUser(request, options.roles);
    if (user instanceof Response) return user;

    try {
      // Routes without dynamic segments get params that resolve to undefined.
      const rawParams = (ctx ? await ctx.params : undefined) ?? {};
      const params = Object.fromEntries(Object.entries(rawParams).map(([k, v]) => [k, Array.isArray(v) ? v.join("/") : v]));
      for (const [key, value] of Object.entries(params)) {
        if (key === "id" && !z.uuid().safeParse(value).success) throw new AdminError(400, "invalid_request", "Invalid id.");
      }

      let body = undefined as B;
      if (options.body) {
        const parsed = options.body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          throw new AdminError(400, "invalid_request", issue?.message ?? "Invalid request.", issue?.path.join("."));
        }
        body = parsed.data;
      }

      const result = await handler({ request, user, body, params });
      return result instanceof Response ? result : Response.json(result ?? { ok: true });
    } catch (error) {
      if (error instanceof AdminError) {
        return Response.json(
          { error: error.code, message: error.message, field: error.field, details: error.details },
          { status: error.status },
        );
      }
      if (error instanceof AvailabilityError) return Response.json({ error: error.code, message: error.message }, { status: 422 });
      if (isPgError(error, "23505")) {
        return Response.json({ error: "duplicate", message: "Something with that name already exists." }, { status: 409 });
      }
      throw error;
    }
  };
}

/**
 * Staff portal route handlers: same plumbing as adminRoute, for technicians only. The handler
 * gets the technician's own staffId, and every query it runs must be scoped to it (AGENTS.md §8).
 */
export function staffRoute<B = undefined>(
  options: { body?: z.ZodType<B> },
  handler: (args: { request: Request; user: StaffUser; body: B; params: Record<string, string> }) => Promise<unknown>,
) {
  return adminRoute({ roles: ["staff"], body: options.body }, ({ user, ...rest }) => {
    if (!user.staffId) throw new AdminError(403, "forbidden", "Your login isn't linked to an artist profile. Ask the owner.");
    return handler({ ...rest, user: { ...user, staffId: user.staffId } });
  });
}

/**
 * Public pages cache the catalog and content (AGENTS.md §5). After an admin edit, expire them
 * immediately so the next visitor sees the change (prices especially must never be stale).
 */
export function refreshPublic(...tags: ("catalog" | "content")[]) {
  for (const tag of tags) revalidateTag(tag === "catalog" ? CATALOG_TAG : CONTENT_TAG, { expire: 0 });
}

/** Rupees typed by a person → paise, as a zod schema (e.g. "1,200" → 120000). */
export const rupeesSchema = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const text = String(v).replace(/[₹,\s]/g, "");
    const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
    if (!m) {
      ctx.addIssue({ code: "custom", message: "Enter an amount in rupees, e.g. 1200" });
      return z.NEVER;
    }
    return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  });

/** URL-safe slug from a name ("Gel Extensions (Full set)" → "gel-extensions-full-set"). */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "item";
}
