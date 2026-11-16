import { describe, expect, it } from "vitest";
import { isTestOnlyAddress } from "@/lib/email-address";

describe("isTestOnlyAddress", () => {
  it.each(["asha.k@example.com", "X@Example.COM", "a@mail.example.org", "a@salon.test", "a@x.invalid", "a@localhost", "a@example.net."])(
    "skips %s",
    (email) => expect(isTestOnlyAddress(email)).toBe(true),
  );

  it.each(["priya@gmail.com", "owner@cembers.in", "a@notexample.com", "a@example.com.in", "a@testing.in"])("sends to %s", (email) =>
    expect(isTestOnlyAddress(email)).toBe(false),
  );
});
