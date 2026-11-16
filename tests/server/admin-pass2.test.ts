import { revalidateTag } from "next/cache";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "@/lib/db";
import { addDays, istToday, weekdayOf } from "@/lib/time";
import { createInstagramPost, deleteInstagramPost } from "@/server/admin/content-admin";
import { categoryUpdateSchema, serviceSchema } from "@/server/admin/schemas";
import { createService, deleteService, listServicesAdmin, updateCategory, updateService } from "@/server/admin/services-admin";
import { addClosure, deleteClosure } from "@/server/admin/settings-admin";
import { addLeave, createStaff, setStaffShifts, updateStaffProfile } from "@/server/admin/staff-admin";
import { createTeamMember, listTeam, resetTeamPassword, updateTeamMember } from "@/server/admin/team";
import { deleteUpload, readUpload, saveImage } from "@/server/uploads";
import { testSql } from "../helpers/test-db";

/** Admin pass 2 against the TEST database (today+8 / +9 so other test files never collide). */

const DATE = addDays(istToday(), 8);
const tag = `p2${Date.now().toString(36)}`;
const ids: Record<string, string> = {};
const PHONE = "8400000001";

beforeAll(async () => {
  const [cat] = await testSql`insert into service_categories (name, slug) values ('P2', ${`${tag}-cat`}) returning id`;
  const [c] = await testSql`insert into customers (name, phone) values ('Booked Customer', ${PHONE}) returning id`;
  Object.assign(ids, { cat: cat.id, customer: c.id });
});

beforeEach(() => vi.mocked(revalidateTag).mockClear());

afterAll(async () => {
  await testSql`delete from bookings where customer_id = ${ids.customer}`;
  await testSql`delete from customers where id = ${ids.customer}`;
  await testSql`delete from users where email like ${`%${tag}%`}`;
  await testSql`delete from staff where slug like ${`${tag}%`}`;
  await testSql`delete from services where category_id = ${ids.cat}`;
  await testSql`delete from service_categories where id = ${ids.cat}`;
  await testSql`delete from salon_closures where reason like ${`${tag}%`}`;
  await testSql`delete from instagram_posts where caption like ${`${tag}%`}`;
  await Promise.all([testSql.end(), sql.end()]);
});

/** A confirmed booking for `staffId` at an IST time on `date`. */
async function book(staffId: string, date: string, from: string, to: string) {
  const [b] = await testSql<{ id: string }[]>`
    insert into bookings (code, customer_id, staff_id, starts_at, ends_at, status, source, total_paise)
    values (${`DB-${Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[^A-Z0-9]/g, "Z")}`}, ${ids.customer}, ${staffId},
            ${`${date} ${from}+05:30`}, ${`${date} ${to}+05:30`}, 'confirmed', 'walk_in', 100000)
    returning id`;
  return b.id;
}

describe("staff", () => {
  it("creates artists with unique slugs and refreshes the public catalog", async () => {
    const a = await createStaff({ name: `${tag} Asha` });
    const b = await createStaff({ name: `${tag} Asha` });
    const rows = await testSql<{ slug: string }[]>`select slug from staff where id in ${testSql([a.id, b.id])} order by slug`;
    expect(rows.map((r) => r.slug)).toEqual([`${tag}-asha`, `${tag}-asha-2`]);
    expect(revalidateTag).toHaveBeenCalledWith("catalog", { expire: 0 });
    ids.staffA = a.id;
  });

  it("previews bookings that new shifts would strand, and saves only when forced", async () => {
    await setStaffShifts(ids.staffA, [{ weekday: weekdayOf(DATE), start: "11:00", end: "20:00" }], false);
    const bookingId = await book(ids.staffA, DATE, "18:00", "19:00");

    const preview = await setStaffShifts(ids.staffA, [{ weekday: weekdayOf(DATE), start: "11:00", end: "15:00" }], false);
    expect(preview).toMatchObject({ saved: false, clashes: [{ id: bookingId }] });
    const [{ count: before }] = await testSql<{ count: number }[]>`
      select count(*)::int as count from staff_shifts where staff_id = ${ids.staffA} and ends_at = '20:00'`;
    expect(before).toBe(1);

    const forced = await setStaffShifts(ids.staffA, [{ weekday: weekdayOf(DATE), start: "11:00", end: "15:00" }], true);
    expect(forced.saved).toBe(true);
    await setStaffShifts(ids.staffA, [{ weekday: weekdayOf(DATE), start: "11:00", end: "20:00" }], true);
  });

  it("rejects overlapping shifts", async () => {
    await expect(
      setStaffShifts(ids.staffA, [{ weekday: 1, start: "11:00", end: "15:00" }, { weekday: 1, start: "14:00", end: "18:00" }], true),
    ).rejects.toMatchObject({ status: 400, message: "Shifts on Monday overlap." });
  });

  it("previews leave that clashes with bookings", async () => {
    const clash = await addLeave(ids.staffA, { startDate: DATE, endDate: DATE, startTime: "17:00", endTime: "20:00" }, false);
    expect(clash.saved).toBe(false);
    expect(clash.clashes).toHaveLength(1);

    const fine = await addLeave(ids.staffA, { startDate: DATE, endDate: DATE, startTime: "11:00", endTime: "13:00", reason: "Doctor" }, false);
    expect(fine).toEqual({ saved: true, clashes: [] });
  });

  it("deletes the old photo file when a new one replaces it", async () => {
    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#f0a" } }).png().toBuffer();
    const first = await saveImage(png, "staff");
    const second = await saveImage(png, "staff");
    await updateStaffProfile(ids.staffA, { photoPath: first.path });
    await updateStaffProfile(ids.staffA, { photoPath: second.path });
    expect(await readUpload(first.path)).toBeNull();
    expect(await readUpload(second.path)).not.toBeNull();
    await updateStaffProfile(ids.staffA, { photoPath: null });
    expect(await readUpload(second.path)).toBeNull();
  });
});

describe("services", () => {
  it("creates a service with its artists and edits it", async () => {
    const { id } = await createService({
      categoryId: ids.cat,
      name: `${tag} Chrome`,
      pricePaise: 90000,
      priceIsFrom: false,
      durationMin: 45,
      bookingAmountOverridePaise: null,
      active: true,
      staffIds: [ids.staffA],
      imagePath: null,
    });
    let svc = (await listServicesAdmin()).services.find((s) => s.id === id);
    expect(svc).toMatchObject({ pricePaise: 90000, staffIds: [ids.staffA] });
    if (!svc) throw new Error("service missing");

    await updateService(id, { ...svc, pricePaise: 95000, staffIds: [] });
    svc = (await listServicesAdmin()).services.find((s) => s.id === id);
    expect(svc).toMatchObject({ pricePaise: 95000, staffIds: [] });
    ids.service = id;
  });

  it("keeps one photo per service, removing the replaced upload", async () => {
    const svc = (await listServicesAdmin()).services.find((s) => s.id === ids.service);
    if (!svc) throw new Error("service missing");
    const image = () => sharp({ create: { width: 40, height: 50, channels: 3, background: "#f0c" } }).png().toBuffer();
    const first = await saveImage(await image(), "services");
    const second = await saveImage(await image(), "services");
    await updateService(ids.service, { ...svc, imagePath: first.path });
    await updateService(ids.service, { ...svc, imagePath: second.path });
    expect(await readUpload(first.path)).toBeNull();
    expect((await listServicesAdmin()).services.find((s) => s.id === ids.service)?.imagePath).toBe(second.path);
    await updateService(ids.service, { ...svc, imagePath: null });
    expect(await readUpload(second.path)).toBeNull();
  });

  it("accepts only uploaded service photos or bundled placeholders", () => {
    const base = { categoryId: ids.cat, name: "Gel", price: "900", priceIsFrom: false, durationMin: 45, bookingAmountOverride: "", active: true, staffIds: [] };
    expect(serviceSchema.safeParse(base).success).toBe(true);
    const ok = (imagePath: unknown) => serviceSchema.safeParse({ ...base, imagePath }).success;
    expect(ok("/uploads/services/0b9b2c1e-1111-4222-8333-944445555666.webp")).toBe(true);
    expect(ok("/placeholders/01-cherry-gloss.svg")).toBe(true);
    expect(ok(null)).toBe(true);
    expect(ok("/uploads/staff/0b9b2c1e-1111-4222-8333-944445555666.webp")).toBe(false);
    expect(ok("https://evil.example/x.jpg")).toBe(false);
    expect(ok("/placeholders/../.env")).toBe(false);
  });

  it("gives categories an optional photo, removing the replaced upload", async () => {
    const photo = await saveImage(await sharp({ create: { width: 40, height: 50, channels: 3, background: "#0cf" } }).png().toBuffer(), "services");
    await updateCategory(ids.cat, { imagePath: photo.path });
    expect((await listServicesAdmin()).categories.find((c) => c.id === ids.cat)?.imagePath).toBe(photo.path);
    await updateCategory(ids.cat, { name: `${tag} Renamed` }); // leaves the photo alone
    expect(await readUpload(photo.path)).not.toBeNull();
    await updateCategory(ids.cat, { imagePath: "/site/manicure.jpg" });
    expect(await readUpload(photo.path)).toBeNull();
    expect(categoryUpdateSchema.safeParse({ imagePath: "/site/../.env.local" }).success).toBe(false);
    expect(categoryUpdateSchema.safeParse({ imagePath: "/site/nail-art.jpg" }).success).toBe(true);
  });

  it("refuses to delete a service that has bookings", async () => {
    const bookingId = await book(ids.staffA, addDays(DATE, 1), "12:00", "13:00");
    await testSql`insert into booking_items (booking_id, service_id, name_snapshot, price_snapshot_paise, duration_snapshot_min)
                  values (${bookingId}, ${ids.service}, 'Chrome', 90000, 45)`;
    await expect(deleteService(ids.service)).rejects.toMatchObject({ code: "in_use" });
  });
});

describe("closures", () => {
  it("previews bookings on the day before closing", async () => {
    const preview = await addClosure(DATE, `${tag} Diwali`, false);
    expect(preview.saved).toBe(false);
    expect(preview.clashes.length).toBeGreaterThan(0);
    const saved = await addClosure(DATE, `${tag} Diwali`, true);
    expect(saved.saved).toBe(true);
    const [row] = await testSql<{ id: string }[]>`select id from salon_closures where date = ${DATE}`;
    await deleteClosure(row.id);
  });
});

describe("instagram", () => {
  it("normalises pasted links and rejects non-Instagram URLs", async () => {
    const { id } = await createInstagramPost({ url: "https://instagram.com/reels/AbC123?igsh=xyz", caption: `${tag} reel`, placement: "portfolio", active: true });
    const [row] = await testSql`select url, kind from instagram_posts where id = ${id}`;
    expect(row).toEqual({ url: "https://www.instagram.com/reel/AbC123/", kind: "reel" });
    await deleteInstagramPost(id);
    await expect(createInstagramPost({ url: "https://evil.example.com/p/x/", placement: "portfolio", active: true })).rejects.toMatchObject({ field: "url" });
  });
});

describe("team", () => {
  it("creates logins with hashed passwords and enforces the owner rules", async () => {
    const owner = await createTeamMember({ name: "Owner", email: `owner-${tag}@daybook.test`, role: "owner", password: "correct-horse-1" });
    const desk = await createTeamMember({ name: "Desk", email: `DESK-${tag}@daybook.test`, role: "receptionist", password: "correct-horse-2" });

    const [account] = await testSql<{ password: string }[]>`select password from accounts where user_id = ${desk.id}`;
    expect(account.password).not.toContain("correct-horse");
    expect((await listTeam()).find((m) => m.id === desk.id)?.email).toBe(`desk-${tag}@daybook.test`);

    await expect(createTeamMember({ name: "Dup", email: `desk-${tag}@daybook.test`, role: "receptionist", password: "correct-horse-3" })).rejects.toMatchObject({
      code: "email_taken",
    });
    await expect(updateTeamMember(owner.id, owner.id, { active: false })).rejects.toMatchObject({ code: "not_allowed" });

    // Deactivating signs them out everywhere.
    await testSql`insert into sessions (expires_at, token, updated_at, user_id) values (now() + interval '1 day', ${`tok-${tag}`}, now(), ${desk.id})`;
    await updateTeamMember(owner.id, desk.id, { active: false });
    const [{ count }] = await testSql<{ count: number }[]>`select count(*)::int as count from sessions where user_id = ${desk.id}`;
    expect(count).toBe(0);

    await resetTeamPassword(owner.id, desk.id, "brand-new-password");
    const [after] = await testSql<{ password: string }[]>`select password from accounts where user_id = ${desk.id}`;
    expect(after.password).not.toBe(account.password);
  });
});

describe("uploads", () => {
  it("resizes, converts to WebP and strips metadata (including GPS)", async () => {
    const photo = await sharp({ create: { width: 3200, height: 2400, channels: 3, background: "#d6008f" } })
      .jpeg()
      .withExif({ IFD0: { Make: "TestPhone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "28/1 36/1 0/1" } })
      .toBuffer();
    expect((await sharp(photo).metadata()).exif).toBeDefined();

    const saved = await saveImage(photo, "portfolio");
    expect(saved.path).toMatch(/^\/uploads\/portfolio\/[0-9a-f-]{36}\.webp$/);
    expect([saved.width, saved.height]).toEqual([1600, 1200]);

    const stored = await readUpload(saved.path);
    if (!stored) throw new Error("upload missing");
    const meta = await sharp(stored).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    await deleteUpload(saved.path);
  });

  it("rejects things that aren't images, and never serves paths outside the upload folder", async () => {
    await expect(saveImage(Buffer.from("<script>alert(1)</script>"), "portfolio")).rejects.toThrow(/doesn't look like an image/);
    expect(await readUpload("/uploads/portfolio/../../../etc/passwd")).toBeNull();
    expect(await readUpload("/placeholders/01-cherry-gloss.svg")).toBeNull();
  });
});
