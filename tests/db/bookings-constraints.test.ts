import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { errorCode, inRollback, testSql } from "../helpers/test-db";

// Postgres error codes
const EXCLUSION_VIOLATION = "23P01";
const CHECK_VIOLATION = "23514";
const INSUFFICIENT_PRIVILEGE = "42501";

afterAll(() => testSql.end());

/** Minimal catalog + two technicians + one customer, created inside the test transaction. */
async function fixtures(tx: TransactionSql) {
  const [cat] = await tx`insert into service_categories (name, slug) values ('Test', 'test-cat') returning id`;
  await tx`insert into services (category_id, name, slug, price_paise, duration_min)
           values (${cat.id}, 'Test service', 'test-service', 100000, 60)`;
  const [a] = await tx`insert into staff (name, slug) values ('Tech A', 'tech-a') returning id`;
  const [b] = await tx`insert into staff (name, slug) values ('Tech B', 'tech-b') returning id`;
  const [c] = await tx`insert into customers (name, phone) values ('Test Customer', '9876543210') returning id`;
  let n = 0;

  /** Inserts a booking for `staff` between two IST wall-clock times on 1 Dec 2026. */
  function book(staff: string, from: string, to: string, status = "confirmed") {
    n += 1;
    const hold = status === "pending" ? new Date(Date.now() + 15 * 60_000) : null;
    return tx`
      insert into bookings (code, customer_id, staff_id, starts_at, ends_at, status, source, total_paise,
                            hold_expires_at, cancelled_at)
      values (${`DB-T${String(n).padStart(3, "0")}`}, ${c.id}, ${staff},
              ${`2026-12-01 ${from}+05:30`}, ${`2026-12-01 ${to}+05:30`}, ${status}, 'online', 100000,
              ${hold}, ${status === "cancelled" ? new Date() : null})`;
  }

  return { techA: a.id as string, techB: b.id as string, book };
}

describe("bookings: double-booking guard (exclusion constraint)", () => {
  it("rejects an overlapping booking for the same technician", () =>
    inRollback(async (tx) => {
      const { techA, book } = await fixtures(tx);
      await book(techA, "16:00", "17:00");
      expect(await errorCode(tx, () => book(techA, "16:30", "17:30"))).toBe(EXCLUSION_VIOLATION);
    }));

  it("treats a pending hold as blocking", () =>
    inRollback(async (tx) => {
      const { techA, book } = await fixtures(tx);
      await book(techA, "16:00", "17:00", "pending");
      expect(await errorCode(tx, () => book(techA, "16:00", "17:00"))).toBe(EXCLUSION_VIOLATION);
    }));

  it("allows back-to-back bookings (end time is exclusive)", () =>
    inRollback(async (tx) => {
      const { techA, book } = await fixtures(tx);
      await book(techA, "16:00", "17:00");
      expect(await errorCode(tx, () => book(techA, "17:00", "18:00"))).toBeNull();
    }));

  it("allows the same time with a different technician", () =>
    inRollback(async (tx) => {
      const { techA, techB, book } = await fixtures(tx);
      await book(techA, "16:00", "17:00");
      expect(await errorCode(tx, () => book(techB, "16:00", "17:00"))).toBeNull();
    }));

  it("ignores cancelled and expired bookings", () =>
    inRollback(async (tx) => {
      const { techA, book } = await fixtures(tx);
      await book(techA, "16:00", "17:00", "cancelled");
      await book(techA, "16:00", "17:00", "expired");
      expect(await errorCode(tx, () => book(techA, "16:00", "17:00"))).toBeNull();
    }));
});

describe("bookings: row rules", () => {
  it("requires hold_expires_at on pending bookings", () =>
    inRollback(async (tx) => {
      const { techA } = await fixtures(tx);
      const [c] = await tx`select id from customers limit 1`;
      const code = await errorCode(
        tx,
        (sp) => sp`insert into bookings (code, customer_id, staff_id, starts_at, ends_at, status, source, total_paise)
                   values ('DB-X001', ${c.id}, ${techA}, now(), now() + interval '1 hour', 'pending', 'online', 1000)`,
      );
      expect(code).toBe(CHECK_VIOLATION);
    }));

  it("rejects non-Indian mobile numbers", () =>
    inRollback(async (tx) => {
      expect(await errorCode(tx, (sp) => sp`insert into customers (name, phone) values ('X', '12345')`)).toBe(
        CHECK_VIOLATION,
      );
    }));
});

describe("app role privileges", () => {
  it("cannot change the schema", () =>
    inRollback(async (tx) => {
      expect(await errorCode(tx, (sp) => sp`create table should_fail (id int)`)).toBe(INSUFFICIENT_PRIVILEGE);
      expect(await errorCode(tx, (sp) => sp`drop table bookings`)).not.toBeNull();
    }));
});
