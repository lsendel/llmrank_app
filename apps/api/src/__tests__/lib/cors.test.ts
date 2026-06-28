import { describe, it, expect } from "vitest";
import { isAllowedOrigin, APP_ORIGINS } from "../../lib/cors";

describe("isAllowedOrigin", () => {
  it("always allows the app's own first-party origins", () => {
    for (const o of APP_ORIGINS) {
      expect(isAllowedOrigin(o, undefined)).toBe(true);
      expect(isAllowedOrigin(o, "")).toBe(true);
    }
  });

  it("denies everything else when no config is set", () => {
    expect(isAllowedOrigin("https://families.care", undefined)).toBe(false);
    expect(isAllowedOrigin("https://evil.com", "")).toBe(false);
  });

  it("allows a configured exact origin only", () => {
    const cfg = "https://app.partner.com";
    expect(isAllowedOrigin("https://app.partner.com", cfg)).toBe(true);
    // exact entry must not match a different host on the same domain
    expect(isAllowedOrigin("https://other.partner.com", cfg)).toBe(false);
  });

  it("allows a configured host suffix for subdomains and apex", () => {
    const cfg = ".care";
    expect(isAllowedOrigin("https://families.care", cfg)).toBe(true);
    expect(isAllowedOrigin("https://www.families.care", cfg)).toBe(true);
    expect(isAllowedOrigin("https://kazoku.care", cfg)).toBe(true);
    expect(isAllowedOrigin("https://care", cfg)).toBe(true); // apex via host===slice(1)
  });

  it("does NOT let a suffix match a lookalike TLD", () => {
    const cfg = ".care";
    // ends with ".com", not ".care" — must be rejected
    expect(isAllowedOrigin("https://evil-care.com", cfg)).toBe(false);
    expect(isAllowedOrigin("https://families.care.evil.com", cfg)).toBe(false);
    // no leading dot in host → "notcare" must not match ".care"
    expect(isAllowedOrigin("https://notcare", cfg)).toBe(false);
  });

  it("supports a mixed comma-separated list and trims whitespace", () => {
    const cfg = " https://app.partner.com , .care ,https://indices.app ";
    expect(isAllowedOrigin("https://app.partner.com", cfg)).toBe(true);
    expect(isAllowedOrigin("https://families.care", cfg)).toBe(true);
    expect(isAllowedOrigin("https://indices.app", cfg)).toBe(true);
    expect(isAllowedOrigin("https://evil.com", cfg)).toBe(false);
  });

  it("rejects a malformed origin string", () => {
    expect(isAllowedOrigin("not a url", ".care")).toBe(false);
    expect(isAllowedOrigin("", ".care")).toBe(false);
  });
});
