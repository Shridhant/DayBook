import "server-only";
import { randomInt } from "node:crypto";
import postgres, { type TransactionSql } from "postgres";
import { sql } from "@/lib/db";
import type { Paise } from "@/lib/money";
import { AvailabilityError } from "./availability-query";

/**
 * Shared insert for online holds and admin bookings: the booking row plus snapshotted items,
 * tried for each candidate technician in order. The bookings_no_overlap constraint is the final
 * guard against double-booking (AGENTS.md §7).
 */

// No 0/O/1/I/L, so codes read cleanly over the phone and on WhatsApp.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateBookingCode(length = 6): string {
  let code = "DB-";
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export function isPgError(error: unknown, code: string, constraint?: string): boolean {
  return (
    error instanceof postgres.PostgresError &&
    error.code === code &&
    (constraint === undefined || error.constraint_name === constraint)
  );
}

export type BookingItemInput = { id: string; name: string; price_paise: number; duration_min: number };

export type InsertBookingParams = {
  customerId: string;
  /** Technicians to try, best first. */
  candidateStaffIds: string[];
  startsAt: Date;
  endsAt: Date;
  status: "pending" | "confirmed";
  source: "online" | "walk_in" | "phone";
  totalPaise: Paise;
  amountDueNowPaise: Paise;
  /** Minutes until a pending hold lapses; required for pending, null for confirmed. */
  holdMinutes: number | null;
  notes: string | null;
  createdByUserId: string | null;
  items: BookingItemInput[];
};

export type InsertedBooking = { id: string; code: string; staffId: string; holdExpiresAt: Date | null };

/**
 * Inserts inside the caller's transaction. Returns null when every candidate is already booked
 * for that time (the caller turns that into a friendly "slot taken").
 */
export async function insertBooking(tx: TransactionSql, p: InsertBookingParams): Promise<InsertedBooking | null> {
  for (const staffId of p.candidateStaffIds) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateBookingCode();
      try {
        return await tx.savepoint(async (sp) => {
          const [row] = await sp<{ id: string; hold_expires_at: Date | null }[]>`
            insert into bookings (code, customer_id, staff_id, starts_at, ends_at, status, source,
                                  total_paise, amount_due_now_paise, hold_expires_at, notes, created_by_user_id)
            values (${code}, ${p.customerId}, ${staffId}, ${p.startsAt}, ${p.endsAt}, ${p.status}, ${p.source},
                    ${p.totalPaise}, ${p.amountDueNowPaise},
                    ${p.holdMinutes === null ? null : sp`now() + make_interval(mins => ${p.holdMinutes})`},
                    ${p.notes}, ${p.createdByUserId})
            returning id, hold_expires_at`;
          await sp`
            insert into booking_items ${sp(
              p.items.map((s, position) => ({
                booking_id: row.id,
                service_id: s.id,
                name_snapshot: s.name,
                price_snapshot_paise: s.price_paise,
                duration_snapshot_min: s.duration_min,
                position,
              })),
            )}`;
          return { id: row.id, code, staffId, holdExpiresAt: row.hold_expires_at };
        });
      } catch (error) {
        if (isPgError(error, "23505", "bookings_code_key")) continue; // code collision: new code
        if (isPgError(error, "23P01", "bookings_no_overlap")) break; // taken: next technician
        throw error;
      }
    }
  }
  return null;
}

export type ServiceRow = BookingItemInput & { booking_amount_override_paise: number | null };

/** Active services in the order given (the customer's order), or AvailabilityError if any is missing. */
export async function loadServicesInOrder(serviceIds: string[]): Promise<ServiceRow[]> {
  const rows = await sql<ServiceRow[]>`
    select id, name, price_paise, duration_min, booking_amount_override_paise
    from services where active and id in ${sql(serviceIds)}`;
  const ordered = serviceIds.map((id) => rows.find((r) => r.id === id));
  if (ordered.some((s) => s === undefined)) {
    throw new AvailabilityError("unknown_service", "One or more services are unavailable.");
  }
  return ordered.filter((s): s is ServiceRow => s !== undefined);
}
