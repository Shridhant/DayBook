import { afterAll, describe, expect, it } from "vitest";
import { POST as holdRoute } from "@/app/api/bookings/hold/route";
import { sql } from "@/lib/db";
import { clientIp, hitRateLimit, LIMITS } from "@/server/rate-limit";
import { testSql } from "../helpers/test-db";

const tag = `rl${Date.now().toString(36)}`;

afterAll(async () => {
  await testSql`delete from request_limits where key like ${`%${tag}%`}`;
  await Promise.all([testSql.end(), sql.end()]);
});

describe("hitRateLimit", () => {
  it("allows up to the limit, then blocks with a retry time", async () => {
    const rule = { limit: 3, windowSeconds: 60 };
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await hitRateLimit(`${tag}:basic`, rule));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[2].remaining).toBe(0);
    expect(results[3].retryAfterSeconds).toBeGreaterThan(0);
    expect(results[3].retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("starts a fresh window once the old one has passed", async () => {
    const rule = { limit: 1, windowSeconds: 60 };
    await hitRateLimit(`${tag}:window`, rule);
    expect((await hitRateLimit(`${tag}:window`, rule)).allowed).toBe(false);
    await testSql`update request_limits set window_start = now() - interval '61 seconds' where key = ${`${tag}:window`}`;
    expect((await hitRateLimit(`${tag}:window`, rule)).allowed).toBe(true);
  });

  it("can't be raced past the limit by concurrent requests", async () => {
    const rule = { limit: 5, windowSeconds: 60 };
    const results = await Promise.all(Array.from({ length: 12 }, () => hitRateLimit(`${tag}:race`, rule)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) => new Request("http://test", { headers });
  it("prefers Cloudflare, then the proxy's headers, then falls back", () => {
    expect(clientIp(req({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(req({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientIp(req({ "x-forwarded-for": "4.4.4.4, 10.0.0.1" }))).toBe("4.4.4.4");
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("POST /api/bookings/hold", () => {
  it("returns 429 with Retry-After once an IP exceeds the hold limit", async () => {
    const ip = `198.51.100.${Date.now() % 250}`;
    await testSql`
      insert into request_limits (key, window_start, count) values (${`hold:ip:${ip}`}, now(), ${LIMITS.holdPerIp.limit})
      on conflict (key) do update set window_start = now(), count = ${LIMITS.holdPerIp.limit}`;
    const response = await holdRoute(new Request("http://test/api/bookings/hold", { method: "POST", headers: { "x-real-ip": ip }, body: "{}" }));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await response.json()).toMatchObject({ error: "rate_limited" });
    await testSql`delete from request_limits where key = ${`hold:ip:${ip}`}`;
  });
});
