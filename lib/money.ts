/**
 * Money helpers (AGENTS.md §7 "Money").
 * All amounts are integer paise (₹1 = 100 paise). Never use floats for money; format only at the edge.
 */

export type Paise = number;

export function isPaise(value: unknown): value is Paise {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Adds paise amounts, throwing if any value isn't a valid paise integer. */
export function sumPaise(...amounts: Paise[]): Paise {
  return amounts.reduce((total, amount) => {
    if (!isPaise(amount)) throw new RangeError(`Invalid paise amount: ${amount}`);
    return total + amount;
  }, 0);
}

/**
 * `percent`% of an amount, rounded half-up to the nearest paisa.
 * Rounding to whole rupees, if wanted, is a business decision for the caller.
 */
export function percentOf(amount: Paise, percent: number): Paise {
  if (!isPaise(amount)) throw new RangeError(`Invalid paise amount: ${amount}`);
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new RangeError(`Invalid percent: ${percent}`);
  // Integer maths: amount * percent fits comfortably in a safe integer for any real price.
  return Math.floor((amount * percent + 50) / 100);
}

/**
 * Parses a rupee amount typed by a person ("1,200", "₹ 1200.50", 1200) into paise.
 * Returns null for anything that isn't a non-negative amount with at most 2 decimals.
 * Works on the string form, so 19.99 becomes exactly 1999 (no float drift).
 */
export function rupeesToPaise(input: string | number): Paise | null {
  const text = String(input).replace(/[₹,\s]/g, "").replace(/^Rs\.?/i, "");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) return null;
  const paise = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? paise : null;
}

/** Paise → rupees as a plain number string for form inputs ("1200", "1200.5" → "1200.50"). */
export function paiseToRupeesInput(amount: Paise): string {
  if (!isPaise(amount)) throw new RangeError(`Invalid paise amount: ${amount}`);
  const rupees = Math.floor(amount / 100);
  const rest = amount % 100;
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, "0")}`;
}

const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

/**
 * "₹1,200", "₹1,20,000" (Indian digit grouping), "₹1,200.50" when there are paise.
 * Integer division keeps the value exact before handing it to Intl.
 */
export function formatINR(amount: Paise): string {
  if (!isPaise(amount)) throw new RangeError(`Invalid paise amount: ${amount}`);
  return amount % 100 === 0 ? inrWhole.format(amount / 100) : inrExact.format(amount / 100);
}
