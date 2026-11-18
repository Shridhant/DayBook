/** Booking statuses, as stored in bookings.status. */
export type BookingStatus = "pending" | "confirmed" | "completed" | "no_show" | "cancelled" | "expired";

/**
 * Booking status lifecycle (AGENTS.md §7), the whole machine in one place.
 *
 * Created as:
 *   online hold          ──► pending    (server/holds.ts, hold_expires_at ≈ 15 min)
 *   front desk booking   ──► confirmed  (server/admin/bookings.ts, no payment)
 *
 * System transitions (each is a conditional UPDATE guarded by the current status, so retries
 * and races are no-ops):
 *   pending   ──paid, or ₹0 due──────────► confirmed  (server/payments.ts)
 *   pending   ──hold expires─────────────► expired    (flipped lazily before new holds:
 *                                                      server/holds.ts, server/admin/bookings.ts)
 *   expired   ──late payment, slot free──► confirmed  (server/payments.ts; slot taken → owner review)
 *   confirmed ──customer cancels─────────► cancelled  (server/manage-booking.ts; refund per policy)
 *   confirmed ──customer reschedules─────► confirmed  (same status, new time)
 *
 * A pending booking whose hold has passed counts as expired everywhere, even before it's
 * flipped. The database's no-overlap constraint covers pending, confirmed and completed.
 *
 * Admin and technician actions are the table below; anything not listed is refused. Pure, so the
 * server and the UI share it:
 *   pending   ──cancel──► cancelled            (releases a customer's hold)
 *   confirmed ──complete─► completed ──reopen─► confirmed
 *   confirmed ──no_show──► no_show   ──reopen─► confirmed
 *   confirmed ──cancel───► cancelled            (final: the slot may be rebooked)
 */

export type AdminAction = "complete" | "no_show" | "cancel" | "reopen";

const TRANSITIONS: Record<AdminAction, Partial<Record<BookingStatus, BookingStatus>>> = {
  complete: { confirmed: "completed" },
  no_show: { confirmed: "no_show" },
  cancel: { confirmed: "cancelled", pending: "cancelled" },
  reopen: { completed: "confirmed", no_show: "confirmed" },
};

/** The status an action leads to from `current`, or null if the action isn't allowed. */
export function nextStatus(current: BookingStatus, action: AdminAction): BookingStatus | null {
  return TRANSITIONS[action][current] ?? null;
}

/** Actions the admin UI should offer for a booking in `current` status. */
export function availableActions(current: BookingStatus): AdminAction[] {
  return (Object.keys(TRANSITIONS) as AdminAction[]).filter((a) => nextStatus(current, a) !== null);
}

/* ---------- Technicians (staff portal) ---------- */

/** Technicians close out their own appointments; cancelling stays with the front desk (refunds, customer contact). */
export const STAFF_ACTIONS = ["complete", "no_show", "reopen"] as const satisfies readonly AdminAction[];
export type StaffAction = (typeof STAFF_ACTIONS)[number];

/** How long after an appointment a technician can still mark it (or undo a mistake). */
export const STAFF_EDIT_DAYS = 7;

/**
 * Actions a technician may take on one of their bookings. Only once it has started (you can't
 * mark a no-show in advance) and for a week afterwards, so old records don't change silently.
 */
export function staffActions(current: BookingStatus, startsAt: Date, now: Date): StaffAction[] {
  if (startsAt > now) return [];
  if (now.getTime() - startsAt.getTime() > STAFF_EDIT_DAYS * 24 * 60 * 60 * 1000) return [];
  return STAFF_ACTIONS.filter((a) => nextStatus(current, a) !== null);
}
