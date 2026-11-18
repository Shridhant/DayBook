import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "@/lib/db";
import { testSql } from "../helpers/test-db";

// The real route handlers, with the session stubbed (no login in tests).
const requireApiUser = vi.fn();
vi.mock("@/server/admin/auth", () => ({ requireApiUser: (...args: unknown[]) => requireApiUser(...args) }));

const { DELETE, PATCH } = await import("@/app/api/admin/portfolio/[id]/route");

const tag = `pf${Date.now().toString(36)}`;
const frontDesk = { id: "u2", name: "F", email: "f@x.test", role: "receptionist", staffId: null };

beforeEach(() => requireApiUser.mockResolvedValue(frontDesk));

afterAll(async () => {
  await testSql`delete from portfolio_items where caption like ${`${tag}%`}`;
  await Promise.all([testSql.end(), sql.end()]);
});

/** A seeded sample photo, as db/seed.sql creates them. */
async function samplePhoto() {
  const [row] = await testSql<{ id: string }[]>`
    insert into portfolio_items (image_path, width, height, alt, caption, featured, sort_order)
    values ('/placeholders/01-cherry-gloss.svg', 800, 1000, 'Illustration of glossy cherry-red manicure', ${`${tag} Cherry gloss`}, true, 7)
    returning id`;
  return row.id;
}

const call = (handler: typeof DELETE, id: string, init: RequestInit = {}) =>
  handler(new Request(`http://test/api/admin/portfolio/${id}`, init), { params: Promise.resolve({ id }) });

describe("sample portfolio photos", () => {
  it("can be deleted by the front desk (the built-in file is left alone)", async () => {
    const id = await samplePhoto();
    const res = await call(DELETE, id, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await testSql`select 1 from portfolio_items where id = ${id}`).toHaveLength(0);
  });

  it("can have the picture replaced, keeping caption, featured flag and position", async () => {
    const id = await samplePhoto();
    const image = { path: "/uploads/portfolio/0190a0b0-0000-7000-8000-000000000001.webp", width: 1200, height: 1500 };
    const body = { image, alt: "Glossy cherry-red almond nails", caption: `${tag} Cherry gloss`, categoryId: null, featured: true, active: true };
    const res = await call(PATCH, id, { method: "PATCH", body: JSON.stringify(body) });
    expect(res.status).toBe(200);

    const [row] = await testSql`select image_path, width, height, featured, sort_order from portfolio_items where id = ${id}`;
    expect(row).toEqual({ image_path: image.path, width: 1200, height: 1500, featured: true, sort_order: 7 });
  });

  it("keeps the picture when an edit sends no new image", async () => {
    const id = await samplePhoto();
    const body = { alt: "Cherry-red nails", caption: `${tag} Renamed`, categoryId: null, featured: false, active: true };
    expect((await call(PATCH, id, { method: "PATCH", body: JSON.stringify(body) })).status).toBe(200);
    const [row] = await testSql`select image_path, caption from portfolio_items where id = ${id}`;
    expect(row).toEqual({ image_path: "/placeholders/01-cherry-gloss.svg", caption: `${tag} Renamed` });
  });

  it("refuses a replacement that isn't one of our uploads", async () => {
    const id = await samplePhoto();
    const body = { image: { path: "https://evil.example.com/x.png", width: 1, height: 1 }, alt: "Cherry-red nails", featured: false, active: true };
    expect((await call(PATCH, id, { method: "PATCH", body: JSON.stringify(body) })).status).toBe(400);
  });
});
