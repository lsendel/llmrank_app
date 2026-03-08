import {
  buildRegionFilter,
  filterKnownProviderIds,
  recommendedProvidersForIntent,
} from "./visibility-tab-helpers";

describe("visibility-tab helpers", () => {
  it("returns the pro discovery provider set", () => {
    expect(recommendedProvidersForIntent("discovery", true)).toEqual([
      "chatgpt",
      "claude",
      "perplexity",
      "gemini_ai_mode",
    ]);
  });

  it("returns the non-pro transactional provider set", () => {
    expect(recommendedProvidersForIntent("transactional", false)).toEqual([
      "chatgpt",
      "gemini",
      "copilot",
    ]);
  });

  it("builds a region filter only when region filtering is enabled", () => {
    expect(buildRegionFilter("all", true)).toBeUndefined();
    expect(buildRegionFilter("de", false)).toBeUndefined();
    expect(buildRegionFilter("de", true)).toEqual({
      region: "de",
      language: "de",
    });
  });

  it("filters unknown provider ids while preserving order", () => {
    expect(
      filterKnownProviderIds(["perplexity", "unknown", "chatgpt", "grok"]),
    ).toEqual(["perplexity", "chatgpt", "grok"]);
  });
});
