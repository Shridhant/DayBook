import { createTestimonial } from "@/server/admin/content-admin";
import { adminRoute, FRONT_DESK } from "@/server/admin/http";
import { testimonialSchema } from "@/server/admin/schemas";

export const POST = adminRoute({ roles: FRONT_DESK, body: testimonialSchema }, ({ body: body }) => createTestimonial(body));
