import { describe, expect, it } from "vitest";
import {
  buildPlatformGuideModel,
  getFactorRecommendation,
  getReadinessScoreClass,
  slugForDisplayName,
} from "./platform-guide-helpers";

describe("platform guide helpers", () => {
  it("maps display names to stable slugs", () => {
    expect(slugForDisplayName("ChatGPT")).toBe("chatgpt");
    expect(slugForDisplayName("Gemini AI Mode")).toBe("gemini_ai_mode");
    expect(slugForDisplayName("Unknown Platform")).toBe("unknown platform");
  });

  it("builds a derived platform guide model", () => {
    const model = buildPlatformGuideModel("chatgpt", [
      {
        platform: "ChatGPT",
        score: 82,
        grade: "A",
        tips: ["Allow GPTBot"],
        checks: [
          {
            factor: "ai_crawlers",
            label: "AI crawlers",
            importance: "critical",
            pass: false,
          },
          {
            factor: "structured_data",
            label: "Structured data",
            importance: "important",
            pass: false,
          },
          {
            factor: "summary",
            label: "Summary section",
            importance: "recommended",
            pass: false,
          },
          {
            factor: "faq",
            label: "FAQ section",
            importance: "recommended",
            pass: true,
          },
        ],
      },
    ]);

    expect(model.displayName).toBe("ChatGPT");
    expect(model.platformIcon).toBe("🤖");
    expect(model.passCount).toBe(1);
    expect(model.totalCount).toBe(4);
    expect(model.passRate).toBe(25);
    expect(model.criticalFails).toHaveLength(1);
    expect(model.importantFails).toHaveLength(1);
    expect(model.recommendedFails).toHaveLength(1);
    expect(model.passing).toHaveLength(1);
    expect(model.scoreToneClass).toBe("text-success");
  });

  it("returns factor recommendations and score tones", () => {
    expect(getFactorRecommendation("ai_crawlers")?.whyItMatters).toMatch(
      /cannot index your content/i,
    );
    expect(getFactorRecommendation("unknown")).toBeUndefined();
    expect(getReadinessScoreClass(85)).toBe("text-success");
    expect(getReadinessScoreClass(65)).toBe("text-warning");
    expect(getReadinessScoreClass(40)).toBe("text-destructive");
  });
});
