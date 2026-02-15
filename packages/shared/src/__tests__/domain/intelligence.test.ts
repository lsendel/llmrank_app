import { describe, it, expect } from "vitest";
import {
  PlatformOpportunitySchema,
  CitationReadinessSchema,
  FusedInsightsSchema,
} from "../../schemas/scoring";

describe("intelligence fusion schemas", () => {
  it("validates platform opportunity", () => {
    const data = {
      platform: "chatgpt",
      currentScore: 72,
      opportunityScore: 18, // how much room to improve
      topTips: ["Add structured FAQ schema", "Increase authority signals"],
      visibilityRate: 0.35, // 35% of visibility checks mention brand
    };
    expect(PlatformOpportunitySchema.safeParse(data).success).toBe(true);
  });

  it("validates citation readiness", () => {
    const data = {
      score: 78,
      components: {
        factCitability: 82,
        llmCitationWorthiness: 75,
        schemaQuality: 80,
        structuredDataCount: 4,
      },
      topCitableFacts: [
        {
          content: "AI SEO tools reduce optimization time by 60%",
          citabilityScore: 92,
        },
      ],
    };
    expect(CitationReadinessSchema.safeParse(data).success).toBe(true);
  });

  it("validates full fused insights", () => {
    const data = {
      aiVisibilityReadiness: 68,
      platformOpportunities: [
        {
          platform: "perplexity",
          currentScore: 58,
          opportunityScore: 32,
          topTips: ["Add publication dates", "Improve freshness signals"],
          visibilityRate: null,
        },
      ],
      contentHealthMatrix: {
        scoring: 72,
        llmQuality: 78,
        engagement: null, // no GA4 data
        uxQuality: null, // no Clarity data
      },
      roiQuickWins: [
        {
          issueCode: "MISSING_SCHEMA",
          scoreImpact: 8,
          estimatedTrafficImpact: 1200,
          effort: "low",
          affectedPages: 5,
        },
      ],
    };
    expect(FusedInsightsSchema.safeParse(data).success).toBe(true);
  });
});
