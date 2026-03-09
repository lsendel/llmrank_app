import { describe, expect, it } from "vitest";
import type { PublicScanResult } from "@/lib/api";
import {
  getFindingItems,
  getPagesSampled,
  getQuickWinEffort,
  getRecurringScanDestination,
  getVisibilityChecks,
  getVisibilityProviderLabel,
} from "./scan-results-helpers";

describe("scan results helpers", () => {
  it("maps visibility provider labels and normalizes visibility payloads", () => {
    expect(getVisibilityProviderLabel("chatgpt")).toBe("ChatGPT");
    expect(getVisibilityProviderLabel("custom_provider")).toBe(
      "custom_provider",
    );
    expect(getVisibilityChecks(null)).toEqual([]);
    expect(
      getVisibilityChecks({
        provider: "claude",
        brandMentioned: true,
        urlCited: false,
      }),
    ).toEqual([{ provider: "claude", brandMentioned: true, urlCited: false }]);
  });

  it("builds findings and page sample counts from scan metadata", () => {
    const meta: NonNullable<PublicScanResult["meta"]> = {
      title: "Example page title with enough characters",
      description: "Example description",
      wordCount: 500,
      hasLlmsTxt: false,
      hasSitemap: true,
      sitemapUrls: 12,
      aiCrawlersBlocked: ["GPTBot"],
      schemaTypes: ["Organization"],
      ogTags: { title: "Example" },
      siteContext: { sitemapAnalysis: { discoveredPageCount: 25 } } as never,
    };

    expect(
      getPagesSampled({
        issues: [{}, {}] as never,
        meta,
        siteContext: undefined,
      }),
    ).toBe(25);

    expect(getFindingItems(meta)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "AI crawlers allowed",
          pass: false,
          details: "Blocked: GPTBot",
        }),
        expect.objectContaining({
          label: "Sitemap found",
          pass: true,
          details: "12 URLs found",
        }),
      ]),
    );
  });

  it("returns recurring destinations and quick-win effort labels", () => {
    expect(getRecurringScanDestination(true)).toBe("/dashboard/projects");
    expect(getRecurringScanDestination(false)).toBe("/pricing");
    expect(getQuickWinEffort("low").label).toBe("Quick Fix");
    expect(getQuickWinEffort("unknown").label).toBe("Moderate");
  });
});
