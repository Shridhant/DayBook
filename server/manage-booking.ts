import "server-only";
import { customerActions, customerChangeTerms, type CustomerActions } from "@/lib/customer-changes";
import { sql } from "@/lib/db";
import { formatINR } from "@/lib/money";
import type { DateKey } from "@/lib/time";
import { getAvailability, type AvailabilityResult } from "./availability-query";
import type { BookingStatus } from "./availability";
import { isPgError } from "./booking-insert";
import { isValidManageKey } from "./manage-link";
import { onBookingCancelled, onBookingRescheduled } from "./notifications";
import { refundBooking, RefundError } from "./refunds";

/**
 * The customer's own "manage my booking" page (phase 2): see the booking, cancel it, or move it.
 * Every entry point takes the booking code plus the signed key from the link (server/manage-link.ts);
 * a wrong key looks exactly like an unknown booking. Rules follow the cancellation policy page
 * (lib/customer-changes.ts).
 */

export class ManageError extends Error {
  constructor(
    public readonly code: "not_found" | "not_allowed" | "slot_unavailable" | "slot_taken" | "changed",
    message: string,
  ) {
    super(message);
  }
}

export type ManagedBooking = {
  id: string;
  code: string;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  staff: { id: string; name: string };
  items: { serviceId: string; name: string; pricePaise: number; durationMin: number }[];
  totalPaise: number;
  /** Paid online, net of refunds. */
  paidPaise: number;
  /** Refunded or on its way back to the customer. */
  refundedPaise: number;
  cancelWindowHours: number;
  /** End of free cancellation / rescheduling. */
  freeUntil: string;
  /** Before `freeUntil` and the appointment: cancelling refunds the booking amount. */
  free: boolean;
  rescheduleCount: number;
  actions: CustomerActions;
};

type Row = {
  id: string; code: string; status: BookingStatus; starts_at: Date; ends_at: Date; staff_id: string; staff_name: string;
  total_paise: number; paid_paise: number; refunded_paise: number; reschedule_count: number; cancel_window_hours: number;
  items: ManagedBooking["items"] | null;
};

async function loadRow(code: string): Promise<Row | undefined> {
  const [row] = await sql<Row[]>`
    select b.id, b.code, b.status, b.starts_at, b.ends_at, b.staff_id, st.name as staff_name, b.total_paise, b.reschedule_count,
           (select cancel_window_hours from settings) as cancel_window_hours,
           coalesce((select sum(p.amount_paise - p.refunded_paise) from payments p where p.booking_id = b.id and p.status = 'captured'), 0)::int as paid_paise,
           coalesce((select sum(r.amount_paise) from refunds r where r.booking_id = b.id and r.status <> 'failed'), 0)::int as refunded_paise,
           (select json_agg(json_build_object('serviceId', i.service_id, 'name', i.name_snapshot, 'pricePaise', i.price_snapshot_paise,
                                              'durationMin', i.duration_snapshot_min) order by i.position)
            from booking_items i where i.booking_id = b.id) as items
    from bookings b join staff st on st.id = b.staff_id
    where b.code = ${code} and b.source = 'online'`;
  return row;
}

function toManaged(r: Row, now: Date): ManagedBooking {
  const terms = customerChangeTerms(r.starts_at, now, r.cancel_window_hours);
  return {
    id: r.id,
    code: r.code,
    status: r.status,
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at.toISOString(),
    staff: { id: r.staff_id, name: r.staff_name },
    items: r.items ?? [],
    totalPaise: r.total_paise,
    paidPaise: r.paid_paise,
    refundedPaise: r.refunded_paise,
    cancelWindowHours: r.cancel_window_hours,
    freeUntil: terms.freeUntil.toISOString(),
    free: terms.free,
    rescheduleCount: r.reschedule_count,
    actions: customerActions({
      status: r.status,
      startsAt: r.starts_at,
      now,
      cancelWindowHours: r.cancel_window_hours,
      rescheduleCount: r.reschedule_count,
      paidPaise: r.paid_paise,
    }),
  };
}

/** The booking for a manage link, or null if the code or key is wrong. */
export async function getManagedBooking(code: string, key: string, now = new Date()): Promise<ManagedBooking | null> {
  const row = await loadRow(code);
  if (!row || !isValidManageKey(row.id, key)) return null;
  return toManaged(row, now);
}

async function requireBooking(code: string, key: string, now: Date): Promise<ManagedBooking> {
  const booking = await getManagedBooking(code, key, now);
  if (!booking) throw new ManageError("not_found", "We couldn't find that booking. Check the link in your confirmation email.");
  return booking;
}

/* ---------- Cancel ---------- */

export type CancelResult = {
  booking: ManagedBooking;
  /** What happened to the money paid online. */
  refund: { amountPaise: number; status: "started" | "pending_owner" } | { status: "not_refundable"; amountPaise: number } | null;
};

export async function cancelByCustomer(code: string, key: string, now = new Date()): Promise<CancelResult> {
  const booking = await requireBooking(code, key, now);
  if (!booking.actions.cancel) throw new ManageError("not_allowed", "This booking can't be cancelled online any more. Please contact the studio.");
  const refundable = booking.actions.refundOnCancel;

  await sql.begin(async (tx) => {
    const [updated] = await tx`
      update bookings set status = 'cancelled', cancelled_at = now(), hold_expires_at = null,
                          cancel_reason = ${refundable ? "Cancelled online by the customer (in time for a refund)" : "Cancelled online by the customer (late: booking amount kept)"}
      where id = ${booking.id} and status = 'confirmed' and starts_at > now()
      returning id`;
    if (!updated) throw new ManageError("changed", "This booking just changed. Refresh the page to see it.");
    await onBookingCancelled(
      tx,
      booking.id,
      "the customer",
      refundable ? `${formatINR(booking.paidPaise)} is being refunded automatically.` : `${formatINR(booking.paidPaise)} kept (late cancellation).`,
    );
  });

  let refund: CancelResult["refund"] = null;
  if (booking.paidPaise > 0 && !refundable) refund = { status: "not_refundable", amountPaise: booking.paidPaise };
  if (refundable) {
    try {
      const result = await refundBooking({ bookingId: booking.id, userId: null, source: "auto", reason: "Customer cancelled in time" });
      refund = { status: "started", amountPaise: result.amountPaise };
    } catch (error) {
      // The booking stays cancelled and shows as "refund due" to the owner (who is alerted if
      // Razorpay rejected it). The customer is told the studio will refund it.
      if (!(error instanceof RefundError)) throw error;
      refund = { status: "pending_owner", amountPaise: booking.paidPaise };
    }
  }

  return { booking: await requireBooking(code, key, new Date()), refund };
}

/* ---------- Reschedule ---------- */

/** Times the customer could move to. `anyArtist` widens the search beyond their current artist. */
export async function rescheduleOptions(code: string, key: string, date: DateKey, anyArtist: boolean): Promise<AvailabilityResult> {
  const booking = await requireBooking(code, key, new Date());
  if (!booking.actions.reschedule) throw new ManageError("not_allowed", "This booking can't be moved online any more. Please contact the studio.");
  return getAvailability({
    date,
    serviceIds: booking.items.map((i) => i.serviceId),
    staffId: anyArtist ? undefined : booking.staff.id,
    ignoreBookingId: booking.id,
  });
}

export async function rescheduleByCustomer(
  code: string,
  key: string,
  target: { date: DateKey; startMinutes: number; anyArtist: boolean },
  now = new Date(),
): Promise<ManagedBooking> {
  const booking = await requireBooking(code, key, now);
  if (!booking.actions.reschedule) throw new ManageError("not_allowed", "This booking can't be moved online any more. Please contact the studio.");

  const availability = await getAvailability({
    date: target.date,
    serviceIds: booking.items.map((i) => i.serviceId),
    staffId: target.anyArtist ? undefined : booking.staff.id,
    ignoreBookingId: booking.id,
    now,
  });
  const slot = availability.slots.find((s) => s.minutes === target.startMinutes);
  if (!slot) throw new ManageError("slot_unavailable", "That time isn't available any more. Please pick another.");

  // Keep their artist whenever they're free; otherwise the best "Any available" choice.
  const staffId = slot.staffIds.includes(booking.staff.id) ? booking.staff.id : slot.staffIds[0];
  // The booking keeps its own services, prices and durations (snapshots), whatever changed since.
  const durationMin = booking.items.reduce((sum, i) => sum + i.durationMin, 0);
  const endsAt = new Date(slot.startsAt.getTime() + durationMin * 60_000);

  try {
    await sql.begin(async (tx) => {
      const [updated] = await tx<{ reschedule_count: number }[]>`
        update bookings set starts_at = ${slot.startsAt}, ends_at = ${endsAt}, staff_id = ${staffId},
                            reschedule_count = reschedule_count + 1
        where id = ${booking.id} and status = 'confirmed' and starts_at = ${new Date(booking.startsAt)}
        returning reschedule_count`;
      if (!updated) throw new ManageError("changed", "This booking just changed. Refresh the page to see it.");
      await onBookingRescheduled(tx, booking.id, { startsAt: new Date(booking.startsAt), staffName: booking.staff.name }, updated.reschedule_count);
    });
  } catch (error) {
    // The exclusion constraint: someone booked that time a moment ago.
    if (isPgError(error, "23P01")) throw new ManageError("slot_taken", "Someone just booked that time. Please pick another.");
    throw error;
  }

  return requireBooking(code, key, new Date());
}
