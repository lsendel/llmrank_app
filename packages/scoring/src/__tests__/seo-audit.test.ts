import { describe, it, expect } from "vitest";
import { scoreTechnicalFactors } from "../factors/technical";
import { scoreMetaTags } from "../dimensions/meta-tags";
import type { PageData } from "../types";
import {
  isValidHreflangCode,
  hreflangHasXDefault,
  invalidHreflangCodes,
} from "../seo-audit";

function makePage(extracted: Partial<PageData["extracted"]> = {}): PageData {
  return {
    url: "https://example.com/test",
    statusCode: 200,
    title: "Test Page Title - Example Site Here", // valid length
    metaDescription:
      "A valid meta description that is between 120 and 160 characters long for testing purposes and validation of the scoring engine implementation here.",
    canonicalUrl: "https://example.com/test",
    wordCount: 800,
    contentHash: "abc",
    extracted: {
      h1: ["Heading"],
      h2: [],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      schema_types: [],
      internal_links: [],
      external_links: [],
      images_without_alt: 0,
      has_robots_meta: false,
      robots_directives: [],
      og_tags: {
        "og:title": "t",
        "og:description": "d",
        "og:image": "/i.png",
      },
      ...extracted,
    } as PageData["extracted"],
    lighthouse: null,
    llmScores: null,
    siteContext: {
      hasLlmsTxt: true,
      aiCrawlersBlocked: [],
      hasSitemap: true,
      contentHashes: new Map(),
    },
  };
}

describe("isValidHreflangCode", () => {
  it("accepts valid BCP-47 codes and x-default", () => {
    for (const c of [
      "en",
      "en-US",
      "pt-BR",
      "zh-Hant",
      "x-default",
      "X-Default",
    ]) {
      expect(isValidHreflangCode(c)).toBe(true);
    }
  });
  it("rejects malformed codes", () => {
    for (const c of ["en_US", "english", "e", "123", "en US", ""]) {
      expect(isValidHreflangCode(c)).toBe(false);
    }
  });
});

describe("hreflang helpers", () => {
  it("detects x-default presence", () => {
    expect(
      hreflangHasXDefault([
        { lang: "en-US", href: "/us" },
        { lang: "x-default", href: "/" },
      ]),
    ).toBe(true);
    expect(hreflangHasXDefault([{ lang: "en-US", href: "/us" }])).toBe(false);
  });
  it("collects invalid codes", () => {
    expect(
      invalidHreflangCodes([
        { lang: "en-US", href: "/us" },
        { lang: "en_GB", href: "/gb" },
      ]),
    ).toEqual(["en_GB"]);
  });
});

describe.each([
  ["v1 technical", scoreTechnicalFactors],
  ["v2 meta-tags", scoreMetaTags],
])("MISSING_ANALYTICS (%s)", (_label, score) => {
  it("flags when analytics_tools is present but empty (measured, none found)", () => {
    const result = score(makePage({ analytics_tools: [] }));
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_ANALYTICS", severity: "info" }),
    );
  });

  it("does NOT flag when an analytics tool is detected", () => {
    const result = score(makePage({ analytics_tools: ["ga4"] }));
    expect(
      result.issues.find((i) => i.code === "MISSING_ANALYTICS"),
    ).toBeUndefined();
  });

  it("does NOT flag when analytics_tools is undefined (not measured)", () => {
    const result = score(makePage({}));
    expect(
      result.issues.find((i) => i.code === "MISSING_ANALYTICS"),
    ).toBeUndefined();
  });
});

describe.each([
  ["v1 technical", scoreTechnicalFactors],
  ["v2 meta-tags", scoreMetaTags],
])("hreflang audit (%s)", (_label, score) => {
  it("flags HREFLANG_INVALID for bad codes", () => {
    const result = score(
      makePage({
        analytics_tools: ["ga4"],
        hreflang: [
          { lang: "en-US", href: "/us" },
          { lang: "en_GB", href: "/gb" },
        ],
      }),
    );
    const issue = result.issues.find((i) => i.code === "HREFLANG_INVALID");
    expect(issue).toBeDefined();
    expect(issue?.data).toEqual({ invalid: ["en_GB"] });
  });

  it("flags HREFLANG_NO_X_DEFAULT when valid codes but no x-default", () => {
    const result = score(
      makePage({
        analytics_tools: ["ga4"],
        hreflang: [
          { lang: "en-US", href: "/us" },
          { lang: "en-GB", href: "/gb" },
        ],
      }),
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "HREFLANG_NO_X_DEFAULT" }),
    );
  });

  it("does NOT flag a valid hreflang set with x-default (the families.care shape)", () => {
    const result = score(
      makePage({
        analytics_tools: ["ga4", "gtm"],
        hreflang: [
          { lang: "en-US", href: "/us" },
          { lang: "x-default", href: "/" },
        ],
      }),
    );
    expect(
      result.issues.find((i) => i.code?.startsWith("HREFLANG")),
    ).toBeUndefined();
  });

  it("does NOT flag pages without hreflang (single-locale is fine)", () => {
    const result = score(makePage({ analytics_tools: ["ga4"] }));
    expect(
      result.issues.find((i) => i.code?.startsWith("HREFLANG")),
    ).toBeUndefined();
  });
});
