import { describe, expect, it } from "vitest";
import { brandCss, site } from "@/lib/site";

describe("brand colours (lib/site.ts)", () => {
  it("are valid hex, so the injected CSS can't break or carry anything else", () => {
    expect(() => brandCss()).not.toThrow();
    for (const value of Object.values(site.colors)) expect(value).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("overrides light and dark tokens with selectors stronger than :root / .dark", () => {
    const css = brandCss({ brand: "#0EA5E9", accent: "#0369A1", accentDeep: "#075985", accentSoft: "#E0F2FE" });
    expect(css).toContain("html:root:not(.dark){--brand:#0EA5E9;--accent:#0369A1;--accent-hover:#075985;--accent-soft:#E0F2FE}");
    expect(css).toContain("html.dark{--brand:#0EA5E9");
  });

  it("rejects anything that isn't a plain hex colour", () => {
    expect(() => brandCss({ ...site.colors, brand: "red;}body{display:none" as `#${string}` })).toThrow(/6-digit hex/);
  });
});
