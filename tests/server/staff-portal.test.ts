import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { addDays, fromIst, istToday, timeToMinutes, weekdayOf } from "@/lib/time";
import { AdminError } from "@/server/admin/http";
import { decideLeave, listLeaveRequests } from "@/server/admin/staff-admin";
import { applyStaffAction, getStaffDay, listOwnLeave, MAX_OPEN_REQUESTS, requestLeave, withdrawLeave } from "@/server/staff-portal";
import { testSql } from "../helpers/test-db";

/** Staff portal against the TEST database (days +12…+20, unused by other test files). */

const DATE = addDays(istToday(), 12);
const tag = `sp${Date.now().toString(36)}`;
const ids: Record<string, string> = {};
const at = (date: string, time: string) => fromIst(date, timeToMinutes(time));

/** Error code thrown by `fn`, for asserting on AdminError. */
async function codeOf(fn: () => Promise<unknown>) {
  try {
    await fn();
    return null;
  } catch (e) {
    if (e instanceof AdminError) return `${e.status} ${e.code}`;
    throw e;
  }
}

async function book(staffId: string, from: string, to: string, status = "confirmed") {
  const [b] = await testSql<{ id: string }[]>`
    insert into bookings (code, customer_id, staff_id, starts_at, ends_at, status, source, total_paise, notes)
    values (${`DB-${Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[^A-Z0-9]/g, "Z")}`}, ${ids.customer}, ${staffId},
            ${at(DATE, from)}, ${at(DATE, to)}, ${status}, 'walk_in', 100000, 'French tips')
    returning id`;
  return b.id;
}

beforeAll(async () => {
  const [a] = await testSql`insert into staff (name, slug, sort_order) values ('Tech A', ${`${tag}-a`}, 1) returning id`;
  const [b] = await testSql`insert into staff (name, slug, sort_order) values ('Tech B', ${`${tag}-b`}, 2) returning id`;
  const [ua] = await testSql`insert into users (name, email, role, staff_id) values ('Tech A', ${`a-${tag}@daybook.test`}, 'staff', ${a.id}) returning id`;
  const [desk] = await testSql`insert into users (name, email, role) values ('Desk', ${`desk-${tag}@daybook.test`}, 'receptionist') returning id`;
  const [c] = await testSql`insert into customers (name, phone) values ('Asha Portal', '8400000077') returning id`;
  await testSql`insert into staff_shifts (staff_id, weekday, starts_at, ends_at) values (${a.id}, ${weekdayOf(DATE)}, '11:00', '20:00')`;
  Object.assign(ids, { a: a.id, b: b.id, userA: ua.id, desk: desk.id, customer: c.id });
  ids.mine = await book(a.id, "12:00", "13:00");
  ids.theirs = await book(b.id, "12:00", "13:00");
});

afterAll(async () => {
  await testSql`delete from bookings where customer_id = ${ids.customer}`;
  await testSql`delete from customers where id = ${ids.customer}`;
  await testSql`delete from users where email like ${`%${tag}%`}`;
  await testSql`delete from staff where slug like ${`${tag}%`}`; // cascades leave → notifications
  await testSql`update settings set show_customer_phone_to_staff = false`;
  await Promise.all([testSql.end(), sql.end()]);
});

describe("technician schedule", () => {
  it("shows only the technician's own bookings, with their shift", async () => {
    const day = await getStaffDay(ids.a, DATE, at(DATE, "09:00"));
    expect(day.bookings.map((b) => b.id)).toEqual([ids.mine]);
    expect(day.shifts).toEqual([{ start: 660, end: 1200 }]);
    expect(day.bookings[0]).toMatchObject({ notes: "French tips", customer: { name: "Asha Portal" } });
  });

  it("hides the customer's phone unless the owner allows it", async () => {
    expect((await getStaffDay(ids.a, DATE)).bookings[0].customer.phone).toBeNull();
    await testSql`update settings set show_customer_phone_to_staff = true`;
    expect((await getStaffDay(ids.a, DATE)).bookings[0].customer.phone).toBe("8400000077");
    await testSql`update settings set show_customer_phone_to_staff = false`;
  });

  it("offers actions only once the appointment has started", async () => {
    expect((await getStaffDay(ids.a, DATE, at(DATE, "11:59"))).bookings[0].actions).toEqual([]);
    expect((await getStaffDay(ids.a, DATE, at(DATE, "12:30"))).bookings[0].actions).toEqual(["complete", "no_show"]);
  });
});

describe("technician booking actions", () => {
  it("marks done and undoes, scoped to the technician", async () => {
    const later = at(DATE, "13:05");
    await applyStaffAction(ids.a, ids.mine, "complete", later);
    expect((await testSql`select status from bookings where id = ${ids.mine}`)[0].status).toBe("completed");
    await applyStaffAction(ids.a, ids.mine, "reopen", later);
    expect((await testSql`select status from bookings where id = ${ids.mine}`)[0].status).toBe("confirmed");
  });

  it("can't touch another technician's booking (looks like it doesn't exist)", async () => {
    expect(await codeOf(() => applyStaffAction(ids.a, ids.theirs, "complete", at(DATE, "13:05")))).toBe("404 not_found");
    expect((await testSql`select status from bookings where id = ${ids.theirs}`)[0].status).toBe("confirmed");
  });

  it("refuses marks before the start and invalid transitions", async () => {
    expect(await codeOf(() => applyStaffAction(ids.a, ids.mine, "no_show", at(DATE, "11:00")))).toBe("409 not_allowed");
    expect(await codeOf(() => applyStaffAction(ids.a, ids.mine, "reopen", at(DATE, "13:05")))).toBe("409 not_allowed");
  });
});

describe("leave requests", () => {
  const user = () => ({ id: ids.userA, staffId: ids.a });
  const day = (n: number) => addDays(istToday(), n);

  it("creates a request that notifies the front desk and doesn't block booking yet", async () => {
    const { id } = await requestLeave(user(), { startDate: day(14), endDate: day(15), reason: "Wedding" });
    const [row] = await testSql`select status, requested_by from staff_leave where id = ${id}`;
    expect(row).toMatchObject({ status: "requested", requested_by: ids.userA });
    const [note] = await testSql`select type, title, body from notifications where staff_leave_id = ${id}`;
    expect(note).toMatchObject({ type: "leave_requested", title: "Leave request: Tech A" });
    expect(note.body).toContain("Wedding");
    expect((await listLeaveRequests()).map((r) => r.id)).toContain(id);
    ids.request = id;
  });

  it("refuses overlapping and past requests", async () => {
    expect(await codeOf(() => requestLeave(user(), { startDate: day(15), endDate: day(16) }))).toBe("409 overlap");
    expect(await codeOf(() => requestLeave(user(), { startDate: day(-3), endDate: day(-2) }))).toBe("400 invalid_leave");
  });

  it("caps open requests per technician", async () => {
    const extra: string[] = [];
    for (let i = 1; i < MAX_OPEN_REQUESTS; i++) extra.push((await requestLeave(user(), { startDate: day(30 + i), endDate: day(30 + i) })).id);
    expect(await codeOf(() => requestLeave(user(), { startDate: day(60), endDate: day(60) }))).toBe("409 too_many_requests");
    for (const id of extra) await withdrawLeave(ids.a, id);
  });

  it("previews clashing bookings before approving, then approves with force", async () => {
    const { id } = await requestLeave(user(), { startDate: DATE, endDate: DATE, startTime: "11:30", endTime: "14:00" });
    const preview = await decideLeave(id, { approve: true, force: false }, ids.desk);
    expect(preview.saved).toBe(false);
    expect(preview.clashes.map((c) => c.id)).toEqual([ids.mine]);
    expect((await testSql`select status from staff_leave where id = ${id}`)[0].status).toBe("requested");

    expect((await decideLeave(id, { approve: true, force: true }, ids.desk)).saved).toBe(true);
    const [row] = await testSql`select status, decided_by from staff_leave where id = ${id}`;
    expect(row).toMatchObject({ status: "approved", decided_by: ids.desk });
    expect((await getStaffDay(ids.a, DATE)).leave).toEqual([{ start: 690, end: 840 }]);
  });

  it("declines with a note the technician sees, and can't be decided twice", async () => {
    expect((await decideLeave(ids.request, { approve: false, note: "Busy weekend", force: false }, ids.desk)).saved).toBe(true);
    const mine = (await listOwnLeave(ids.a)).find((l) => l.id === ids.request);
    expect(mine).toMatchObject({ status: "rejected", decisionNote: "Busy weekend" });
    expect(await codeOf(() => decideLeave(ids.request, { approve: true, force: true }, ids.desk))).toBe("409 already_decided");
  });

  it("lets a technician withdraw only unanswered requests of their own", async () => {
    expect(await codeOf(() => withdrawLeave(ids.a, ids.request))).toBe("409 not_allowed");
    const { id } = await requestLeave(user(), { startDate: day(20), endDate: day(20) });
    expect(await codeOf(() => withdrawLeave(ids.b, id))).toBe("409 not_allowed");
    await withdrawLeave(ids.a, id);
    expect(await testSql`select 1 from staff_leave where id = ${id}`).toHaveLength(0);
    expect(await testSql`select 1 from notifications where staff_leave_id = ${id}`).toHaveLength(0);
  });
});
