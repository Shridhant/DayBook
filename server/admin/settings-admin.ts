import "server-only";
import { sql } from "@/lib/db";
import { istDayRange, minutesToTime, timeToMinutes, type DateKey } from "@/lib/time";
import { AdminError, notFound, refreshPublic } from "./http";
import type { Clash } from "./staff-admin";

/** Salon settings, opening hours (owner) and closures (owner + front desk). */

export type AdminSettings = {
  bookingAmountType: "fixed" | "percent";
  bookingAmountFixedPaise: number;
  bookingAmountPercent: number;
  cancelWindowHours: number;
  slotIntervalMin: number;
  bookingWindowDays: number;
  leadTimeMin: number;
  holdMinutes: number;
  showCustomerPhoneToStaff: boolean;
  hours: { weekday: number; open: boolean; opensAt: string; closesAt: string }[];
};

export async function getSettingsAdmin(): Promise<AdminSettings> {
  const [[s], hours] = await Promise.all([
    sql<{ booking_amount_type: "fixed" | "percent"; booking_amount_fixed_paise: number; booking_amount_percent: number; cancel_window_hours: number;
          slot_interval_min: number; booking_window_days: number; lead_time_min: number; hold_minutes: number; show_customer_phone_to_staff: boolean }[]>`
      select * from settings`,
    sql<{ weekday: number; opens_at: string; closes_at: string }[]>`select weekday, opens_at, closes_at from opening_hours`,
  ]);
  return {
    bookingAmountType: s.booking_amount_type,
    bookingAmountFixedPaise: s.booking_amount_fixed_paise,
    bookingAmountPercent: s.booking_amount_percent,
    cancelWindowHours: s.cancel_window_hours,
    slotIntervalMin: s.slot_interval_min,
    bookingWindowDays: s.booking_window_days,
    leadTimeMin: s.lead_time_min,
    holdMinutes: s.hold_minutes,
    showCustomerPhoneToStaff: s.show_customer_phone_to_staff,
    hours: Array.from({ length: 7 }, (_, weekday) => {
      const h = hours.find((x) => x.weekday === weekday);
      return {
        weekday,
        open: Boolean(h),
        opensAt: h ? minutesToTime(timeToMinutes(h.opens_at)) : "11:00",
        closesAt: h ? minutesToTime(timeToMinutes(h.closes_at)) : "20:00",
      };
    }),
  };
}

export type SettingsInput = Omit<AdminSettings, "hours">;

export async function updateSettings(input: SettingsInput) {
  await sql`
    update settings set
      booking_amount_type = ${input.bookingAmountType},
      booking_amount_fixed_paise = ${input.bookingAmountFixedPaise},
      booking_amount_percent = ${input.bookingAmountPercent},
      cancel_window_hours = ${input.cancelWindowHours},
      slot_interval_min = ${input.slotIntervalMin},
      booking_window_days = ${input.bookingWindowDays},
      lead_time_min = ${input.leadTimeMin},
      hold_minutes = ${input.holdMinutes},
      show_customer_phone_to_staff = ${input.showCustomerPhoneToStaff}`;
  refreshPublic("catalog");
}

export async function setOpeningHours(days: AdminSettings["hours"]) {
  const open = days.filter((d) => d.open);
  for (const d of open) {
    let start: number;
    let end: number;
    try {
      start = timeToMinutes(d.opensAt);
      end = timeToMinutes(d.closesAt);
    } catch {
      throw new AdminError(400, "invalid_hours", "Enter valid opening times.");
    }
    if (end <= start) throw new AdminError(400, "invalid_hours", "Closing time must be after opening time.");
  }
  await sql.begin(async (tx) => {
    await tx`delete from opening_hours`;
    if (open.length) {
      await tx`insert into opening_hours ${tx(open.map((d) => ({ weekday: d.weekday, opens_at: d.opensAt, closes_at: d.closesAt })))}`;
    }
  });
  refreshPublic("catalog");
}

/* ---------- Closures ---------- */

export type AdminClosure = { id: string; date: DateKey; reason: string | null; bookings: number };

export async function listClosures(): Promise<AdminClosure[]> {
  return sql<AdminClosure[]>`
    select c.id, to_char(c.date, 'YYYY-MM-DD') as date, c.reason,
           (select count(*)::int from bookings b
            where b.status in ('pending', 'confirmed')
              and (b.starts_at at time zone 'Asia/Kolkata')::date = c.date) as bookings
    from salon_closures c
    where c.date >= (now() at time zone 'Asia/Kolkata')::date - 30
    order by c.date`;
}

/** Closes the salon for a day. Existing bookings that day are returned for confirmation unless `force`. */
export async function addClosure(date: DateKey, reason: string | undefined, force: boolean): Promise<{ clashes: Clash[]; saved: boolean }> {
  const day = istDayRange(date);
  const clashes = await sql<Clash[]>`
    select b.id, b.code, c.name as customer, to_json(b.starts_at) #>> '{}' as "startsAt", to_json(b.ends_at) #>> '{}' as "endsAt"
    from bookings b join customers c on c.id = b.customer_id
    where b.status in ('pending', 'confirmed') and b.starts_at < ${day.end} and b.ends_at > ${day.start}
    order by b.starts_at`;
  if (clashes.length && !force) return { clashes, saved: false };
  await sql`insert into salon_closures (date, reason) values (${date}, ${reason?.trim() || null})`;
  refreshPublic("catalog");
  return { clashes, saved: true };
}

export async function deleteClosure(id: string) {
  const [row] = await sql`delete from salon_closures where id = ${id} returning id`;
  if (!row) throw notFound("Closure");
  refreshPublic("catalog");
}
