import { describe, expect, it } from "vitest";
import type { StrategyCompetitor, VisibilityGap } from "@/lib/api";
import {
  buildCompetitorDomainSet,
  buildPersonaIdentityKey,
  DEFAULT_VISIBILITY_PROVIDERS,
  DEMAND_FLOW_NICHE,
  getRecommendedCompetitorDomains,
  getSuggestedKeywordSelection,
  toggleSelectedKeyword,
} from "./strategy-tab-helpers";

describe("strategy-tab-helpers", () => {
  it("exports stable demand-flow defaults", () => {
    expect(DEMAND_FLOW_NICHE).toBe("AI SEO and Content Optimization");
    expect(DEFAULT_VISIBILITY_PROVIDERS).toEqual([
      "chatgpt",
      "claude",
      "perplexity",
      "gemini",
    ]);
  });

  it("normalizes persona identity keys and competitor domain sets", () => {
    const competitors = [
      { id: "1", projectId: "proj-1", domain: "Example.com", createdAt: "" },
      { id: "2", projectId: "proj-1", domain: "SECOND.com", createdAt: "" },
    ] satisfies StrategyCompetitor[];

    expect(
      buildPersonaIdentityKey({ name: "Decision Maker", role: "CMO" }),
    ).toBe("decision maker::cmo");
    expect(Array.from(buildCompetitorDomainSet(competitors))).toEqual([
      "example.com",
      "second.com",
    ]);
  });

  it("dedupes recommended competitor domains, filters existing ones, and caps the list", () => {
    const visibilityGaps = [
      {
        query: "query-1",
        providers: ["chatgpt"],
        userMentioned: false,
        userCited: false,
        competitorsCited: [
          { domain: "known.com", position: 1 },
          { domain: " NewOne.com ", position: 2 },
          { domain: "newone.com", position: 3 },
        ],
      },
      {
        query: "query-2",
        providers: ["claude"],
        userMentioned: false,
        userCited: false,
        competitorsCited: [
          { domain: "two.com", position: 1 },
          { domain: "three.com", position: 2 },
          { domain: "four.com", position: 3 },
          { domain: "five.com", position: 4 },
          { domain: "six.com", position: 5 },
          { domain: "seven.com", position: 6 },
        ],
      },
    ] satisfies VisibilityGap[];

    expect(
      getRecommendedCompetitorDomains({
        visibilityGaps,
        existingCompetitorDomains: new Set(["known.com"]),
      }),
    ).toEqual([
      "newone.com",
      "two.com",
      "three.com",
      "four.com",
      "five.com",
      "six.com",
    ]);
  });

  it("filters saved keywords and auto-selects the first unsaved suggestions", () => {
    expect(
      getSuggestedKeywordSelection({
        suggestedKeywords: ["Alpha", "beta", "Gamma", "delta"],
        savedKeywords: [{ keyword: "BETA" }, { keyword: "delta" }],
        autoSelectLimit: 2,
      }),
    ).toEqual({
      filtered: ["Alpha", "Gamma"],
      autoSelected: ["Alpha", "Gamma"],
    });
  });

  it("toggles selected keywords without mutating unrelated entries", () => {
    expect(toggleSelectedKeyword(["alpha", "beta"], "beta")).toEqual(["alpha"]);
    expect(toggleSelectedKeyword(["alpha"], "beta")).toEqual(["alpha", "beta"]);
  });
});
