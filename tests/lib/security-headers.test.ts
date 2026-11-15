import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

describe("content security policy", () => {
  const prod = contentSecurityPolicy({ dev: false });

  it("allows exactly the third parties the site uses", () => {
    expect(directive(prod, "script-src")).toContain("https://checkout.razorpay.com");
    expect(directive(prod, "frame-src")).toContain("https://*.razorpay.com");
    expect(directive(prod, "frame-src")).toContain("https://www.instagram.com");
    expect(directive(prod, "frame-src")).toContain("https://www.google.com");
    expect(directive(prod, "connect-src")).toBe("connect-src 'self' https://*.razorpay.com");
  });

  it("blocks framing, plugins, base-tag tricks and off-site form posts", () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("base-uri 'self'");
    expect(prod).toContain("form-action 'self'");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("never allows eval or websockets in production, only in development", () => {
    expect(prod).not.toContain("unsafe-eval");
    expect(prod).not.toContain("ws:");
    const dev = contentSecurityPolicy({ dev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
});

describe("security headers", () => {
  it("sets the standard hardening headers, and HSTS only in production", () => {
    const keys = (dev: boolean) => securityHeaders({ dev }).map((h) => h.key);
    expect(keys(false)).toEqual(
      expect.arrayContaining(["Content-Security-Policy", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"]),
    );
    expect(keys(true)).not.toContain("Strict-Transport-Security");
  });

  it("keeps pop-ups working for Razorpay's bank pages", () => {
    expect(securityHeaders({ dev: false }).find((h) => h.key === "Cross-Origin-Opener-Policy")?.value).toBe("same-origin-allow-popups");
  });
});
