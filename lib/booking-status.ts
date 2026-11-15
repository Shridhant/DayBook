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
