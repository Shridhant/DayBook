/**
 * What a customer may change on their own booking (manage link), following the cancellation
 * policy page: free cancellation or rescheduling up to `cancel_window_hours` before the
 * appointment; after that they can still cancel, but the booking amount isn't refunded.
 * Pure, so the manage page and the server agree.
 */

/** Customers can move a booking this many times; after that they contact the studio. */
export const MAX_CUSTOMER_RESCHEDULES = 2;

export type CustomerChangeTerms = {
  /** The appointment hasn't started yet. */
  upcoming: boolean;
  /** Still outside the cancel window: free cancellation (with refund) and rescheduling. */
  free: boolean;
  /** When the free period ends. */
  freeUntil: Date;
};

export function customerChangeTerms(startsAt: Date, now: Date, cancelWindowHours: number): CustomerChangeTerms {
  const freeUntil = new Date(startsAt.getTime() - cancelWindowHours * 60 * 60 * 1000);
  return { upcoming: now < startsAt, free: now <= freeUntil && now < startsAt, freeUntil };
}

export type CustomerActions = { cancel: boolean; reschedule: boolean; refundOnCancel: boolean };

export function customerActions(params: {
  status: string;
  startsAt: Date;
  now: Date;
  cancelWindowHours: number;
  rescheduleCount: number;
  paidPaise: number;
}): CustomerActions {
  const terms = customerChangeTerms(params.startsAt, params.now, params.cancelWindowHours);
  const open = params.status === "confirmed" && terms.upcoming;
  return {
    cancel: open,
    reschedule: open && terms.free && params.rescheduleCount < MAX_CUSTOMER_RESCHEDULES,
    refundOnCancel: open && terms.free && params.paidPaise > 0,
  };
}
