import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Exercise the route wrapper without a real session: requireApiUser is stubbed per test.
const requireApiUser = vi.fn();
vi.mock("@/server/admin/auth", () => ({ requireApiUser: (...args: unknown[]) => requireApiUser(...args) }));

const { adminRoute, AdminError, OWNER_ONLY } = await import("@/server/admin/http");

const owner = { id: "u1", name: "O", email: "o@x.test", role: "owner", staffId: null };
const post = (body: unknown) => new Request("http://test/api", { method: "POST", body: JSON.stringify(body) });

describe("adminRoute", () => {
  const route = adminRoute({ roles: OWNER_ONLY, body: z.object({ name: z.string().min(2, "Enter a name") }) }, async ({ body, params }) => ({
    hello: body.name,
    params,
  }));

  it("works for routes without dynamic params (params resolve to undefined)", async () => {
    requireApiUser.mockResolvedValue(owner);
    const res = await route(post({ name: "Asha" }), { params: Promise.resolve(undefined) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hello: "Asha", params: {} });
  });

  it("works when Next passes no context at all", async () => {
    requireApiUser.mockResolvedValue(owner);
    expect((await route(post({ name: "Asha" }))).status).toBe(200);
  });

  it("returns the auth response unchanged (401/403)", async () => {
    requireApiUser.mockResolvedValue(Response.json({ error: "forbidden" }, { status: 403 }));
    expect((await route(post({ name: "Asha" }))).status).toBe(403);
  });

  it("returns 400 with the first validation message and field", async () => {
    requireApiUser.mockResolvedValue(owner);
    const res = await route(post({ name: "A" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ message: "Enter a name", field: "name" });
  });

  it("rejects non-uuid ids and maps AdminError to its status", async () => {
    requireApiUser.mockResolvedValue(owner);
    const byId = adminRoute({ roles: OWNER_ONLY }, async () => {
      throw new AdminError(409, "not_allowed", "Nope");
    });
    expect((await byId(new Request("http://test"), { params: Promise.resolve({ id: "not-a-uuid" }) })).status).toBe(400);
    const res = await byId(new Request("http://test"), { params: Promise.resolve({ id: "01900000-0000-7000-8000-000000000000" }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "not_allowed", message: "Nope" });
  });
});
