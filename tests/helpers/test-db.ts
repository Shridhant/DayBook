import postgres, { type TransactionSql } from "postgres";

/**
 * Connection to the TEST database as the app role, so tests also prove the app's privileges.
 * Run `npm run db:test:prepare` after adding migrations.
 */
const url = process.env.DATABASE_URL_TEST;
if (!url || !new URL(url).pathname.endsWith("_test")) {
  throw new Error("DATABASE_URL_TEST must point at a database whose name ends in _test.");
}

export const testSql = postgres(url, { max: 4, onnotice: () => {} });

class Rollback extends Error {}

/** Runs `fn` in a transaction that is always rolled back, so tests leave no data behind. */
export async function inRollback(fn: (tx: TransactionSql) => Promise<void>) {
  try {
    await testSql.begin(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

/** Postgres error code of a failed statement, run inside a savepoint so the transaction survives. */
export async function errorCode(tx: TransactionSql, run: (sp: TransactionSql) => Promise<unknown>) {
  try {
    await tx.savepoint(run);
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? "unknown";
  }
}

/** Removes notifications and queued emails created for these bookings (booking events have side effects). */
export async function cleanupBookingEvents(bookingIds: string[]) {
  if (!bookingIds.length) return;
  await testSql`delete from notifications where booking_id in ${testSql(bookingIds)}`;
  await testSql`delete from email_outbox where ${testSql.unsafe(
    bookingIds.map((id) => `dedupe_key like '%${id.replace(/[^0-9a-f-]/g, "")}%'`).join(" or "),
  )}`;
}
