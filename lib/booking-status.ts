/** Booking statuses, as stored in bookings.status. */
export type BookingStatus = "pending" | "confirmed" | "completed" | "no_show" | "cancelled" | "expired";

/**
 * Booking status lifecycle (AGENTS.md §7). Admin actions map to transitions; anything not listed
 * here is refused. Pure, so both the server and the admin UI use it.
 *
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
