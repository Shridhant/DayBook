import { deleteTestimonial, updateTestimonial } from "@/server/admin/content-admin";
import { adminRoute, FRONT_DESK } from "@/server/admin/http";
import { testimonialSchema } from "@/server/admin/schemas";

export const PATCH = adminRoute({ roles: FRONT_DESK, body: testimonialSchema }, ({ body, params }) => updateTestimonial(params.id, body));
export const DELETE = adminRoute({ roles: FRONT_DESK }, ({ params }) => deleteTestimonial(params.id));
