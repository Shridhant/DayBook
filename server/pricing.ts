import "server-only";
import { percentOf, sumPaise, type Paise } from "@/lib/money";

/**
 * Prices and the booking amount (AGENTS.md §7 "Booking amount").
 * Always computed on the server from database values, never from client input.
 */

export type BookingAmountSettings =
  | { type: "fixed"; fixedPaise: Paise; percent?: number }
  | { type: "percent"; percent: number; fixedPaise?: Paise };

export type PricedService = { pricePaise: Paise; bookingAmountOverridePaise: Paise | null };

const TEN_RUPEES = 1000;

/**
 * Nearest ₹10, half up (₹246.80 → ₹250, ₹244.99 → ₹240). A positive amount never rounds down to ₹0,
 * so a small percentage still takes a real booking amount.
 */
export function roundToTenRupees(amount: Paise): Paise {
  const rounded = Math.floor((amount + TEN_RUPEES / 2) / TEN_RUPEES) * TEN_RUPEES;
  return amount > 0 && rounded === 0 ? TEN_RUPEES : rounded;
}

export function totalPrice(services: PricedService[]): Paise {
  return sumPaise(...services.map((s) => s.pricePaise));
}

/**
 * What the customer pays online to hold the slot:
 * 1. If any selected service has an override, the largest override.
 * 2. Otherwise the settings rule: a fixed amount, or a percentage of the total rounded to ₹10.
 * Never more than the total.
 */
export function bookingAmount(services: PricedService[], settings: BookingAmountSettings): Paise {
  const total = totalPrice(services);
  const overrides = services.map((s) => s.bookingAmountOverridePaise).filter((o): o is Paise => o !== null);

  let amount: Paise;
  if (overrides.length > 0) amount = Math.max(...overrides);
  else if (settings.type === "fixed") amount = settings.fixedPaise;
  else amount = roundToTenRupees(percentOf(total, settings.percent));

  return Math.min(amount, total);
}
