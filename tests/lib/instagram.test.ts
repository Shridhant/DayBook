import { describe, expect, it } from "vitest";
import { instagramEmbedUrl, parseInstagramUrl } from "@/lib/instagram";

describe("parseInstagramUrl", () => {
  it.each([
    ["https://www.instagram.com/reel/C9xYz_12-ab/", "reel", "https://www.instagram.com/reel/C9xYz_12-ab/"],
    ["https://instagram.com/reels/C9xYz12ab?igsh=MXZ3", "reel", "https://www.instagram.com/reel/C9xYz12ab/"],
    ["https://www.instagram.com/p/DAbc123/?utm_source=ig_web_copy_link", "post", "https://www.instagram.com/p/DAbc123/"],
    ["  https://www.instagram.com/p/DAbc123  ", "post", "https://www.instagram.com/p/DAbc123/"],
  ])("normalises %s", (input, kind, url) => {
    expect(parseInstagramUrl(input)).toMatchObject({ kind, url });
  });

  it.each([
    "http://www.instagram.com/p/DAbc123/", // not https
    "https://www.instagram.com/yoursalon/", // a profile, not a post
    "https://www.instagram.com/stories/yoursalon/123/",
    "https://evil.example.com/p/DAbc123/",
    "https://www.instagram.com.evil.com/p/DAbc123/",
    "javascript:alert(1)",
    "",
  ])("rejects %s", (input) => {
    expect(parseInstagramUrl(input)).toBeNull();
  });

  it("produces URLs that satisfy the database check constraint", () => {
    const dbRule = /^https:\/\/www\.instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+\/?$/;
    for (const input of ["https://instagram.com/reels/ABC?x=1", "https://www.instagram.com/p/XYZ"]) {
      expect(parseInstagramUrl(input)?.url).toMatch(dbRule);
    }
  });
});

describe("instagramEmbedUrl", () => {
  it("appends /embed", () => {
    expect(instagramEmbedUrl("https://www.instagram.com/reel/ABC/")).toBe("https://www.instagram.com/reel/ABC/embed");
    expect(instagramEmbedUrl("https://www.instagram.com/p/ABC")).toBe("https://www.instagram.com/p/ABC/embed");
  });
});
