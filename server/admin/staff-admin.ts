import "server-only";
import { sql } from "@/lib/db";
import { minutesToTime, timeToMinutes, toIst } from "@/lib/time";
import { deleteUpload } from "../uploads";
import { AdminError, notFound, refreshPublic, slugify } from "./http";
import { leaveRange, outsideShifts, validateShifts, type LeaveInput, type ShiftInput } from "./rules";

/** Staff (artists): profile, skills, weekly shifts, leave. */

export type StaffListItem = {
  id: string;
  name: string;
  specialties: string | null;
  photoPath: string | null;
  active: boolean;
  skillCount: number;
  workDays: number[];
  sortOrder: number;
};

export type Clash = { id: string; code: string; customer: string; startsAt: string; endsAt: string };

export type StaffDetail = {
  id: string;
  name: string;
  bio: string | null;
  specialties: string | null;
  photoPath: string | null;
  active: boolean;
  sortOrder: number;
  serviceIds: string[];
  shifts: { weekday: number; start: string; end: string }[];
  leave: { id: string; startsAt: string; endsAt: string; reason: string | null }[];
  upcomingBookings: number;
};

export async function listStaffAdmin(): Promise<StaffListItem[]> {
  const rows = await sql<
    { id: string; name: string; specialties: string | null; photo_path: string | null; active: boolean; sort_order: number; skill_count: number; work_days: number[] | null }[]
  >`
    select st.id, st.name, st.specialties, st.photo_path, st.active, st.sort_order,
           (select count(*)::int from staff_services ss where ss.staff_id = st.id) as skill_count,
           (select array_agg(distinct sh.weekday order by sh.weekday) from staff_shifts sh where sh.staff_id = st.id) as work_days
    from staff st order by st.active desc, st.sort_order, st.name`;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    specialties: r.specialties,
    photoPath: r.photo_path,
    active: r.active,
    skillCount: r.skill_count,
    workDays: r.work_days ?? [],
    sortOrder: r.sort_order,
  }));
}

export async function getStaffDetail(id: string): Promise<StaffDetail | null> {
  const [staff] = await sql<{ id: string; name: string; bio: string | null; specialties: string | null; photo_path: string | null; active: boolean; sort_order: number }[]>`
    select id, name, bio, specialties, photo_path, active, sort_order from staff where id = ${id}`;
  if (!staff) return null;
  const [skills, shifts, leave, [{ upcoming }]] = await Promise.all([
    sql<{ service_id: string }[]>`select service_id from staff_services where staff_id = ${id}`,
    sql<{ weekday: number; starts_at: string; ends_at: string }[]>`
      select weekday, starts_at, ends_at from staff_shifts where staff_id = ${id} order by weekday, starts_at`,
    sql<{ id: string; starts_at: Date; ends_at: Date; reason: string | null }[]>`
      select id, starts_at, ends_at, reason from staff_leave
      where staff_id = ${id} and status = 'approved' and ends_at > now() order by starts_at`,
    sql<{ upcoming: number }[]>`
      select count(*)::int as upcoming from bookings
      where staff_id = ${id} and status in ('pending', 'confirmed') and starts_at > now()`,
  ]);
  return {
    id: staff.id,
    name: staff.name,
    bio: staff.bio,
    specialties: staff.specialties,
    photoPath: staff.photo_path,
    active: staff.active,
    sortOrder: staff.sort_order,
    serviceIds: skills.map((s) => s.service_id),
    shifts: shifts.map((s) => ({
      weekday: s.weekday,
      start: minutesToTime(timeToMinutes(s.starts_at)),
      end: minutesToTime(timeToMinutes(s.ends_at)),
    })),
    leave: leave.map((l) => ({ id: l.id, startsAt: l.starts_at.toISOString(), endsAt: l.ends_at.toISOString(), reason: l.reason })),
    upcomingBookings: upcoming,
  };
}

/** A slug not yet used in `table`, derived from `name`. Table names are hard-coded by callers. */
export async function uniqueSlug(table: "staff" | "services" | "service_categories", name: string, exceptId?: string) {
  const base = slugify(name);
  const taken = await sql<{ slug: string }[]>`
    select slug from ${sql(table)} where (slug = ${base} or slug like ${`${base}-%`})
    ${exceptId ? sql`and id <> ${exceptId}` : sql``}`;
  const used = new Set(taken.map((t) => t.slug));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

export async function createStaff(input: { name: string; specialties?: string; bio?: string }): Promise<{ id: string }> {
  const slug = await uniqueSlug("staff", input.name);
  const [row] = await sql<{ id: string }[]>`
    insert into staff (name, slug, specialties, bio, sort_order)
    values (${input.name}, ${slug}, ${input.specialties || null}, ${input.bio || null},
            (select coalesce(max(sort_order), 0) + 1 from staff))
    returning id`;
  refreshPublic("catalog");
  return row;
}

export async function updateStaffProfile(
  id: string,
  input: { name?: string; specialties?: string | null; bio?: string | null; photoPath?: string | null; active?: boolean; sortOrder?: number },
) {
  const [current] = await sql<{ photo_path: string | null; name: string }[]>`select photo_path, name from staff where id = ${id}`;
  if (!current) throw notFound("Artist");
  const slug = input.name && input.name !== current.name ? await uniqueSlug("staff", input.name, id) : undefined;

  await sql`
    update staff set
      name = coalesce(${input.name ?? null}, name),
      slug = coalesce(${slug ?? null}, slug),
      specialties = ${input.specialties === undefined ? sql`specialties` : input.specialties || null},
      bio = ${input.bio === undefined ? sql`bio` : input.bio || null},
      photo_path = ${input.photoPath === undefined ? sql`photo_path` : input.photoPath},
      active = coalesce(${input.active ?? null}, active),
      sort_order = coalesce(${input.sortOrder ?? null}, sort_order)
    where id = ${id}`;
  if (input.photoPath !== undefined && current.photo_path !== input.photoPath) await deleteUpload(current.photo_path);
  refreshPublic("catalog");
}

export async function setStaffSkills(id: string, serviceIds: string[]) {
  await sql.begin(async (tx) => {
    const [exists] = await tx`select 1 from staff where id = ${id}`;
    if (!exists) throw notFound("Artist");
    await tx`delete from staff_services where staff_id = ${id}`;
    if (serviceIds.length) {
      await tx`insert into staff_services ${tx(serviceIds.map((service_id) => ({ staff_id: id, service_id })))}`;
    }
  });
  refreshPublic("catalog");
}

/** Upcoming bookings for an artist with their IST weekday/minutes. */
async function upcomingBookings(staffId: string) {
  const rows = await sql<{ id: string; code: string; customer: string; starts_at: Date; ends_at: Date }[]>`
    select b.id, b.code, c.name as customer, b.starts_at, b.ends_at
    from bookings b join customers c on c.id = b.customer_id
    where b.staff_id = ${staffId} and b.status in ('pending', 'confirmed') and b.starts_at > now()
    order by b.starts_at`;
  return rows.map((r) => {
    const start = toIst(r.starts_at);
    const end = toIst(r.ends_at);
    return {
      id: r.id,
      code: r.code,
      customer: r.customer,
      startsAt: r.starts_at.toISOString(),
      endsAt: r.ends_at.toISOString(),
      weekday: start.weekday,
      startMin: start.minutes,
      endMin: end.date === start.date ? end.minutes : 1440,
    };
  });
}

const toClash = (b: { id: string; code: string; customer: string; startsAt: string; endsAt: string }): Clash => ({
  id: b.id,
  code: b.code,
  customer: b.customer,
  startsAt: b.startsAt,
  endsAt: b.endsAt,
});

/**
 * Replaces the weekly schedule. If upcoming bookings would fall outside the new hours, nothing is
 * saved unless `force` is set: the caller shows the clashes first.
 */
export async function setStaffShifts(id: string, input: ShiftInput[], force: boolean): Promise<{ clashes: Clash[]; saved: boolean }> {
  const result = validateShifts(input);
  if ("error" in result) throw new AdminError(400, "invalid_shifts", result.error);

  const clashes = outsideShifts(await upcomingBookings(id), result.shifts).map(toClash);
  if (clashes.length && !force) return { clashes, saved: false };

  await sql.begin(async (tx) => {
    const [exists] = await tx`select 1 from staff where id = ${id}`;
    if (!exists) throw notFound("Artist");
    await tx`delete from staff_shifts where staff_id = ${id}`;
    if (result.shifts.length) {
      await tx`insert into staff_shifts ${tx(
        result.shifts.map((s) => ({ staff_id: id, weekday: s.weekday, starts_at: minutesToTime(s.start), ends_at: minutesToTime(s.end) })),
      )}`;
    }
  });
  refreshPublic("catalog");
  return { clashes, saved: true };
}

/** Adds approved leave. Clashing bookings are returned for confirmation unless `force` is set. */
export async function addLeave(
  staffId: string,
  input: LeaveInput & { reason?: string },
  force: boolean,
): Promise<{ clashes: Clash[]; saved: boolean }> {
  const range = leaveRange(input);
  if ("error" in range) throw new AdminError(400, "invalid_leave", range.error);

  const clashes = (await upcomingBookings(staffId))
    .filter((b) => new Date(b.startsAt) < range.end && new Date(b.endsAt) > range.start)
    .map(toClash);
  if (clashes.length && !force) return { clashes, saved: false };

  const [exists] = await sql`select 1 from staff where id = ${staffId}`;
  if (!exists) throw notFound("Artist");
  await sql`
    insert into staff_leave (staff_id, starts_at, ends_at, reason, status)
    values (${staffId}, ${range.start}, ${range.end}, ${input.reason?.trim() || null}, 'approved')`;
  return { clashes, saved: true };
}

export async function deleteLeave(leaveId: string) {
  const [row] = await sql`delete from staff_leave where id = ${leaveId} returning id`;
  if (!row) throw notFound("Leave");
}

/* ---------- Leave requests from technicians (staff portal) ---------- */

export type LeaveRequest = {
  id: string;
  staffId: string;
  staffName: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  requestedAt: string;
  /** Upcoming bookings the leave would overlap, so the front desk sees the cost before approving. */
  clashCount: number;
};

/** Unanswered requests that haven't already passed, oldest first. */
export async function listLeaveRequests(): Promise<LeaveRequest[]> {
  return sql<LeaveRequest[]>`
    select l.id, l.staff_id as "staffId", st.name as "staffName", to_json(l.starts_at) #>> '{}' as "startsAt",
           to_json(l.ends_at) #>> '{}' as "endsAt", l.reason, to_json(l.created_at) #>> '{}' as "requestedAt",
           (select count(*)::int from bookings b
            where b.staff_id = l.staff_id and b.status in ('pending', 'confirmed') and b.starts_at > now()
              and b.starts_at < l.ends_at and b.ends_at > l.starts_at) as "clashCount"
    from staff_leave l join staff st on st.id = l.staff_id
    where l.status = 'requested' and l.ends_at > now()
    order by l.created_at`;
}

/**
 * Approves or declines a technician's request. Approving leave that overlaps bookings returns the
 * clashes first (like adding leave directly); the UI resends with `force`.
 */
export async function decideLeave(
  leaveId: string,
  decision: { approve: boolean; note?: string | null; force: boolean },
  userId: string,
): Promise<{ clashes: Clash[]; saved: boolean }> {
  const [leave] = await sql<{ staff_id: string; starts_at: Date; ends_at: Date; status: string }[]>`
    select staff_id, starts_at, ends_at, status from staff_leave where id = ${leaveId}`;
  if (!leave) throw notFound("Leave request");
  if (leave.status !== "requested") throw new AdminError(409, "already_decided", "This request was already answered.");

  let clashes: Clash[] = [];
  if (decision.approve) {
    clashes = (await upcomingBookings(leave.staff_id))
      .filter((b) => new Date(b.startsAt) < leave.ends_at && new Date(b.endsAt) > leave.starts_at)
      .map(toClash);
    if (clashes.length && !decision.force) return { clashes, saved: false };
  }

  const [updated] = await sql`
    update staff_leave set
      status = ${decision.approve ? "approved" : "rejected"},
      decided_by = ${userId},
      decided_at = now(),
      decision_note = ${decision.note?.trim() || null}
    where id = ${leaveId} and status = 'requested'
    returning id`;
  // Withdrawn or answered by someone else in the meantime.
  if (!updated) throw new AdminError(409, "already_decided", "This request was just withdrawn or answered. Refresh to see it.");
  return { clashes, saved: true };
}
