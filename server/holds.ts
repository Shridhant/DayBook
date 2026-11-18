import "server-only";
import { sql } from "@/lib/db";
import type { Paise } from "@/lib/money";
import type { DateKey } from "@/lib/time";
import { getAvailability } from "./availability-query";
import { insertBooking, loadServicesInOrder } from "./booking-insert";
import { bookingAmount, totalPrice, type BookingAmountSettings } from "@/lib/pricing";

export { generateBookingCode } from "./booking-insert";

/**
 * Slot holds (AGENTS.md §7 "Booking status lifecycle"). A hold is a `pending` booking that blocks
 * the slot for `settings.hold_minutes` while the customer pays.
 *
 * Safety comes from the database: the bookings_no_overlap exclusion constraint rejects a second
 * active booking for the same technician and time, even if two requests race past the
 * availability check together.
 */

export type HoldRequest = {
  serviceIds: string[];
  /** A specific technician, or undefined for "Any available". */
  staffId?: string;
  date: DateKey;
  /** Start time, minutes since IST midnight. Must be one of the offered slots. */
  startMinutes: number;
  customer: { name: string; phone: string; email?: string };
  notes?: string;
};

export type Hold = {
  bookingId: string;
  code: string;
  staff: { id: string; name: string };
  startsAt: Date;
  endsAt: Date;
  holdExpiresAt: Date;
  totalPaise: Paise;
  amountDueNowPaise: Paise;
  items: { serviceId: string; name: string; pricePaise: Paise; durationMin: number }[];
};

export class HoldError extends Error {
  constructor(
    public readonly code: "slot_unavailable" | "slot_taken",
    message: string,
  ) {
    super(message);
  }
}

export async function createHold(request: HoldRequest): Promise<Hold> {
  // 1. Fresh availability. This applies every rule (qualification, shifts, leave, lead time,
  //    window) and ranks technicians for "Any available".
  const availability = await getAvailability({
    date: request.date,
    serviceIds: request.serviceIds,
    staffId: request.staffId,
    ignoreHoldsOfPhone: request.customer.phone,
  });
  const slot = availability.slots.find((s) => s.minutes === request.startMinutes);
  if (!slot) {
    throw new HoldError("slot_unavailable", "That time is no longer available. Please pick another slot.");
  }

  // 2. Price from the database, in the order the customer chose the services.
  const [settings] = await sql<
    { booking_amount_type: "fixed" | "percent"; booking_amount_fixed_paise: number; booking_amount_percent: number; hold_minutes: number }[]
  >`select booking_amount_type, booking_amount_fixed_paise, booking_amount_percent, hold_minutes from settings`;
  const items = await loadServicesInOrder(request.serviceIds);

  const priced = items.map((s) => ({ pricePaise: s.price_paise, bookingAmountOverridePaise: s.booking_amount_override_paise }));
  const amountSettings: BookingAmountSettings =
    settings.booking_amount_type === "fixed"
      ? { type: "fixed", fixedPaise: settings.booking_amount_fixed_paise }
      : { type: "percent", percent: settings.booking_amount_percent };
  const total = totalPrice(priced);
  const dueNow = bookingAmount(priced, amountSettings);

  // 3. Insert inside a transaction; candidates are tried in ranked order.
  return sql.begin(async (tx) => {
    // Release lapsed holds so they stop blocking the constraint.
    await tx`update bookings set status = 'expired'
             where status = 'pending' and hold_expires_at <= now()`;

    // One customer = one live hold: going back and picking another time releases the old one.
    const [customer] = await tx<{ id: string }[]>`
      insert into customers (name, phone, email)
      values (${request.customer.name}, ${request.customer.phone}, ${request.customer.email ?? null})
      on conflict (phone) do update set email = coalesce(customers.email, excluded.email)
      returning id`;
    await tx`update bookings set status = 'expired'
             where customer_id = ${customer.id} and status = 'pending'`;

    const booking = await insertBooking(tx, {
      customerId: customer.id,
      customerEmail: request.customer.email ?? null,
      candidateStaffIds: slot.staffIds,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: "pending",
      source: "online",
      totalPaise: total,
      amountDueNowPaise: dueNow,
      holdMinutes: settings.hold_minutes,
      notes: request.notes ?? null,
      createdByUserId: null,
      items,
    });
    if (!booking?.holdExpiresAt) {
      throw new HoldError("slot_taken", "Someone just booked that time. Please pick another slot.");
    }

    const [staff] = await tx<{ name: string }[]>`select name from staff where id = ${booking.staffId}`;
    return {
      bookingId: booking.id,
      code: booking.code,
      staff: { id: booking.staffId, name: staff.name },
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      holdExpiresAt: booking.holdExpiresAt,
      totalPaise: total,
      amountDueNowPaise: dueNow,
      items: items.map((s) => ({ serviceId: s.id, name: s.name, pricePaise: s.price_paise, durationMin: s.duration_min })),
    };
  });
}
