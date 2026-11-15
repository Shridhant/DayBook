import "server-only";
import { randomInt } from "node:crypto";
import postgres from "postgres";
import { sql } from "@/lib/db";
import type { Paise } from "@/lib/money";
import type { DateKey } from "@/lib/time";
import { AvailabilityError, getAvailability } from "./availability-query";
import { bookingAmount, totalPrice, type BookingAmountSettings } from "./pricing";

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

/* ---------- Booking codes ---------- */

// No 0/O/1/I/L, so codes read cleanly over the phone and on WhatsApp.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateBookingCode(length = 6): string {
  let code = "DB-";
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

function isPgError(error: unknown, code: string, constraint?: string): boolean {
  return (
    error instanceof postgres.PostgresError &&
    error.code === code &&
    (constraint === undefined || error.constraint_name === constraint)
  );
}

/* ---------- Create hold ---------- */

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
  const rows = await sql<
    { id: string; name: string; price_paise: number; duration_min: number; booking_amount_override_paise: number | null }[]
  >`select id, name, price_paise, duration_min, booking_amount_override_paise
    from services where active and id in ${sql(request.serviceIds)}`;
  const services = request.serviceIds.map((id) => rows.find((r) => r.id === id));
  if (services.some((s) => s === undefined)) {
    throw new AvailabilityError("unknown_service", "One or more services are unavailable.");
  }
  const items = services.filter((s): s is NonNullable<typeof s> => s !== undefined);

  const priced = items.map((s) => ({ pricePaise: s.price_paise, bookingAmountOverridePaise: s.booking_amount_override_paise }));
  const amountSettings: BookingAmountSettings =
    settings.booking_amount_type === "fixed"
      ? { type: "fixed", fixedPaise: settings.booking_amount_fixed_paise }
      : { type: "percent", percent: settings.booking_amount_percent };
  const total = totalPrice(priced);
  const dueNow = bookingAmount(priced, amountSettings);

  // 3. Insert inside a transaction. Candidates are tried in ranked order; if one was taken a moment
  //    ago (exclusion violation), the next free technician gets the booking.
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

    for (const staffId of slot.staffIds) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = generateBookingCode();
        try {
          const booking = await tx.savepoint(async (sp) => {
            const [row] = await sp<{ id: string; hold_expires_at: Date }[]>`
              insert into bookings (code, customer_id, staff_id, starts_at, ends_at, status, source,
                                    total_paise, amount_due_now_paise, hold_expires_at, notes)
              values (${code}, ${customer.id}, ${staffId}, ${slot.startsAt}, ${slot.endsAt}, 'pending', 'online',
                      ${total}, ${dueNow}, now() + make_interval(mins => ${settings.hold_minutes}),
                      ${request.notes ?? null})
              returning id, hold_expires_at`;
            await sp`
              insert into booking_items ${sp(
                items.map((s, position) => ({
                  booking_id: row.id,
                  service_id: s.id,
                  name_snapshot: s.name,
                  price_snapshot_paise: s.price_paise,
                  duration_snapshot_min: s.duration_min,
                  position,
                })),
              )}`;
            return row;
          });

          const [staff] = await tx<{ name: string }[]>`select name from staff where id = ${staffId}`;
          return {
            bookingId: booking.id,
            code,
            staff: { id: staffId, name: staff.name },
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            holdExpiresAt: booking.hold_expires_at,
            totalPaise: total,
            amountDueNowPaise: dueNow,
            items: items.map((s) => ({ serviceId: s.id, name: s.name, pricePaise: s.price_paise, durationMin: s.duration_min })),
          };
        } catch (error) {
          if (isPgError(error, "23505", "bookings_code_key")) continue; // code collision: new code
          if (isPgError(error, "23P01", "bookings_no_overlap")) break; // taken: next technician
          throw error;
        }
      }
    }

    throw new HoldError("slot_taken", "Someone just booked that time. Please pick another slot.");
  });
}
