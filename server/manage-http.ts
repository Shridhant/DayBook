import "server-only";
import { z } from "zod";
import { isDateKey } from "@/lib/time";
import { AvailabilityError } from "./availability-query";
import { MANAGE_KEY_PATTERN } from "./manage-link";
import { ManageError } from "./manage-booking";

/** Shared validation and error mapping for the public manage-booking routes. */

export const manageAuthSchema = z.object({
  code: z.string().regex(/^DB-[0-9A-Z]{4,8}$/, "Invalid booking link"),
  key: z.string().regex(MANAGE_KEY_PATTERN, "Invalid booking link"),
});

export const dateKeySchema = z.string().refine(isDateKey, "Invalid date");

export const noStore = { "Cache-Control": "no-store" };

const STATUS: Record<ManageError["code"], number> = {
  not_found: 404,
  not_allowed: 409,
  slot_unavailable: 409,
  slot_taken: 409,
  changed: 409,
};

/** Maps domain errors to friendly JSON; anything else is rethrown (500, logged by Next). */
export function manageErrorResponse(error: unknown): Response {
  if (error instanceof ManageError) {
    return Response.json({ error: error.code, message: error.message }, { status: STATUS[error.code], headers: noStore });
  }
  if (error instanceof AvailabilityError) {
    return Response.json(
      { error: error.code, message: "A service in this booking isn't offered online any more. Please contact the studio to move it." },
      { status: 409, headers: noStore },
    );
  }
  throw error;
}

export function invalidRequest(message = "Invalid request") {
  return Response.json({ error: "invalid_request", message }, { status: 400, headers: noStore });
}
