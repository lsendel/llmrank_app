import { describe, it, expect } from "vitest";
import { normalizeDomain } from "../utils/normalize-domain";

describe("normalizeDomain", () => {
  it("strips https:// prefix", () => {
    expect(normalizeDomain("https://example.com")).toBe("example.com");
  });

  it("strips http:// prefix", () => {
    expect(normalizeDomain("http://example.com")).toBe("example.com");
  });

  it("strips www. prefix", () => {
    expect(normalizeDomain("www.example.com")).toBe("example.com");
  });

  it("strips both protocol and www", () => {
    expect(normalizeDomain("https://www.example.com")).toBe("example.com");
  });

  it("strips trailing slash", () => {
    expect(normalizeDomain("https://example.com/")).toBe("example.com");
  });

  it("strips path after domain", () => {
    expect(normalizeDomain("https://example.com/about/team")).toBe(
      "example.com",
    );
  });

  it("preserves subdomains other than www", () => {
    expect(normalizeDomain("https://blog.example.com")).toBe(
      "blog.example.com",
    );
    expect(normalizeDomain("shop.example.com")).toBe("shop.example.com");
    expect(normalizeDomain("https://app.staging.example.com")).toBe(
      "app.staging.example.com",
    );
  });

  it("strips www from subdomain chains", () => {
    expect(normalizeDomain("https://www.blog.example.com")).toBe(
      "blog.example.com",
    );
  });

  it("lowercases the domain", () => {
    expect(normalizeDomain("HTTPS://WWW.Example.COM")).toBe("example.com");
    expect(normalizeDomain("Blog.EXAMPLE.com")).toBe("blog.example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeDomain("  example.com  ")).toBe("example.com");
    expect(normalizeDomain("  https://www.example.com/  ")).toBe("example.com");
  });

  it("handles already-clean domains", () => {
    expect(normalizeDomain("example.com")).toBe("example.com");
    expect(normalizeDomain("blog.example.com")).toBe("blog.example.com");
  });

  it("handles protocol with trailing slashes", () => {
    expect(normalizeDomain("https://example.com///")).toBe("example.com");
  });

  it("strips query strings and fragments", () => {
    expect(normalizeDomain("https://example.com?ref=google")).toBe(
      "example.com",
    );
    expect(normalizeDomain("https://example.com#section")).toBe("example.com");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeDomain("")).toBe("");
    expect(normalizeDomain("   ")).toBe("");
  });
});
