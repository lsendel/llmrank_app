import { describe, it, expect } from "vitest";
import {
  generateRecommendations,
  generateStrengths,
  RECOMMENDATION_TEMPLATES,
} from "../recommendations";
import type { Issue } from "@llm-boost/shared";

const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  code: overrides.code ?? "MISSING_TITLE",
  category: overrides.category ?? "technical",
  severity: overrides.severity ?? "warning",
  message: overrides.message ?? "",
  recommendation: overrides.recommendation ?? "Add the missing element.",
});

describe("generateRecommendations", () => {
  it("returns empty array for no issues", () => {
    expect(generateRecommendations([], 90)).toEqual([]);
  });

  it("deduplicates issues by code and sorts by severity", () => {
    const issues = [
      makeIssue({ code: "MISSING_TITLE", severity: "warning" }),
      makeIssue({ code: "MISSING_TITLE", severity: "critical" }),
      makeIssue({ code: "MISSING_META_DESC", severity: "info" }),
    ];
    const result = generateRecommendations(issues, 70);
    expect(result).toHaveLength(2);
    expect(result[0].issueCode).toBe("MISSING_TITLE");
    expect(result[0].priority).toBe("high");
  });

  it("creates templates for every defined issue code", () => {
    const templateCodes = Object.keys(RECOMMENDATION_TEMPLATES);
    expect(templateCodes.length).toBeGreaterThan(30);
  });

  it("caps recommendations at provided max", () => {
    const issues = Object.keys(RECOMMENDATION_TEMPLATES).map((code) =>
      makeIssue({ code }),
    );
    expect(generateRecommendations(issues, 50, 5).length).toBeLessThanOrEqual(
      5,
    );
  });
});

describe("generateStrengths", () => {
  const categoryScores = {
    technical: 90,
    content: 92,
    aiReadiness: 91,
    performance: 88,
  };

  it("returns strengths for high-scoring categories", () => {
    const strengths = generateStrengths(categoryScores, []);
    expect(strengths).not.toHaveLength(0);
  });

  it("skips categories with critical issues", () => {
    const strengths = generateStrengths(categoryScores, [
      makeIssue({
        code: "HTTP_STATUS",
        category: "technical",
        severity: "critical",
      }),
    ]);
    expect(strengths.find((s) => s.category === "technical")).toBeUndefined();
  });
});
