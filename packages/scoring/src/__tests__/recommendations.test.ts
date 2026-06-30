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
  ...(overrides.data ? { data: overrides.data } : {}),
  ...(overrides.scoreImpact !== undefined
    ? { scoreImpact: overrides.scoreImpact }
    : {}),
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

describe("implementation snippets (#2E)", () => {
  it("emits how-to-fix steps for codes that now carry a snippet", () => {
    const cases: Array<[string, string]> = [
      ["INCOMPLETE_SCHEMA", "application/ld+json"],
      ["INVALID_SCHEMA", "@type"],
      ["MISSING_ENTITY_MARKUP", "sameAs"],
      ["NO_DIRECT_ANSWERS", "<p><strong>"],
      ["LLMS_TXT_QUALITY", "## Docs"],
      ["LLMS_TXT_INCOMPLETE", "## Key Pages"],
      ["HEADING_HIERARCHY", "<h2>"],
    ];
    for (const [code, marker] of cases) {
      const [rec] = generateRecommendations([makeIssue({ code })], 70);
      expect(rec.steps, `${code} should have steps`).toBeDefined();
      expect(rec.steps?.join("\n")).toContain(marker);
    }
  });
});

describe("page-specific recommendations (#2A)", () => {
  it("names the exact count from issue.data", () => {
    const [rec] = generateRecommendations(
      [
        makeIssue({
          code: "MISSING_ALT_TEXT",
          recommendation: "Add descriptive alt text to all images.",
          data: { imagesWithoutAlt: 12 },
        }),
      ],
      80,
    );
    expect(rec.description).toContain("12 images are missing alt text");
  });

  it("lists the blocked crawlers by name", () => {
    const [rec] = generateRecommendations(
      [
        makeIssue({
          code: "AI_CRAWLER_BLOCKED",
          category: "ai_readiness",
          recommendation: "Allow AI crawlers in robots.txt.",
          data: { blockedCrawlers: ["GPTBot", "ClaudeBot"] },
        }),
      ],
      80,
    );
    expect(rec.description).toContain("GPTBot");
    expect(rec.description).toContain("ClaudeBot");
  });

  it("prefers the factor's per-instance recommendation and does not double-count", () => {
    const custom =
      "This page has only 80 words and isn't optimized for LLM citations. Aim for 500+ words.";
    const [rec] = generateRecommendations(
      [
        makeIssue({
          code: "THIN_CONTENT",
          category: "content",
          recommendation: custom,
          data: { wordCount: 80 },
        }),
      ],
      70,
    );
    // Uses the custom recommendation verbatim...
    expect(rec.description).toContain("only 80 words");
    // ...and does NOT append a redundant "This page has 80 words." clause.
    expect(rec.description.match(/80/g) ?? []).toHaveLength(1);
  });

  it("appends the heading jump even though the template mentions H1/H2/H3", () => {
    // Regression: dataValueAlreadyShown used to substring-match "H1"/"H3" in the
    // generic template ("...H1 > H2 > H3...") and drop the specifics clause.
    const [rec] = generateRecommendations(
      [
        makeIssue({
          code: "HEADING_HIERARCHY",
          recommendation:
            "Ensure headings follow a logical hierarchy: H1 > H2 > H3 without skipping levels.",
          data: { skippedFrom: "H1", skippedTo: "H3" },
        }),
      ],
      80,
    );
    expect(rec.description).toContain("Headings jump from H1 to H3");
  });

  it("renders the page weight from the LARGE_PAGE_SIZE payload", () => {
    const [rec] = generateRecommendations(
      [
        makeIssue({
          code: "LARGE_PAGE_SIZE",
          category: "performance",
          recommendation: "Reduce the total page weight.",
          data: { pageSizeBytes: 3_500_000, pageSizeMB: 3.34 },
        }),
      ],
      80,
    );
    expect(rec.description).toContain("3.34MB");
  });

  it("falls back to the template when there is no presentable data", () => {
    const [rec] = generateRecommendations(
      [makeIssue({ code: "MISSING_TITLE" })],
      70,
    );
    expect(rec.description.length).toBeGreaterThan(0);
  });
});

describe("real predicted score lift (#2B)", () => {
  it("returns the category-weighted headline delta, not the raw deduction", () => {
    // MISSING_TITLE is technical (weight .25) with scoreImpact -15 → +4 overall.
    const [rec] = generateRecommendations(
      [makeIssue({ code: "MISSING_TITLE", category: "technical" })],
      50,
    );
    expect(rec.estimatedImprovement).toBe(4);
  });

  it("uses the per-instance applied deduction for dynamic factors (scoreImpact:0 defs)", () => {
    // CONTENT_DEPTH's definition has scoreImpact 0 (computed at runtime). Without
    // the per-instance amount this collapsed to the +1 floor and mis-sorted.
    const [rec] = generateRecommendations(
      [
        makeIssue({
          code: "CONTENT_DEPTH",
          category: "content",
          scoreImpact: -15,
          data: { llmScore: 25 },
        }),
      ],
      50,
    );
    // content weight .30 → round(15 * .30) = 5, not the +1 floor.
    expect(rec.estimatedImprovement).toBe(5);
  });

  it("never reports more lift than the page's remaining headroom", () => {
    // overall 98 → only 2 points to gain, so a +4 fix is capped at +2.
    const [rec] = generateRecommendations(
      [makeIssue({ code: "MISSING_TITLE", category: "technical" })],
      98,
    );
    expect(rec.estimatedImprovement).toBe(2);
  });

  it("floors every real issue at +1 (never +0)", () => {
    const recs = generateRecommendations(
      Object.keys(RECOMMENDATION_TEMPLATES).map((code) => makeIssue({ code })),
      55,
    );
    for (const rec of recs) {
      expect(rec.estimatedImprovement).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("unified impact×effort prioritization (#2C)", () => {
  it("ranks an easy moderate-impact fix above a hard high-impact one", () => {
    const recs = generateRecommendations(
      [
        // big impact but high effort: 16 × 2 / 4 = 8
        makeIssue({
          code: "CONTENT_DEPTH",
          category: "content",
          severity: "warning",
          scoreImpact: -16,
        }),
        // smaller impact but low effort: 8 × 2 / 1 = 16
        makeIssue({
          code: "NO_INTERNAL_LINKS",
          category: "content",
          severity: "warning",
          scoreImpact: -8,
        }),
      ],
      60,
    );
    expect(recs[0].issueCode).toBe("NO_INTERNAL_LINKS");
    expect(recs[1].issueCode).toBe("CONTENT_DEPTH");
  });

  it("still ranks a critical high-impact issue first", () => {
    const recs = generateRecommendations(
      [
        makeIssue({ code: "NO_INTERNAL_LINKS", severity: "warning" }),
        makeIssue({ code: "MISSING_TITLE", severity: "critical" }),
      ],
      60,
    );
    expect(recs[0].issueCode).toBe("MISSING_TITLE");
  });

  it("keeps a critical above warnings even when the critical is higher-effort", () => {
    // HTTP_STATUS (critical, high effort) priority 18.75 vs MISSING_META_DESC
    // (warning, low effort) 20 — but a broken page must still lead.
    const recs = generateRecommendations(
      [
        makeIssue({ code: "MISSING_META_DESC", severity: "warning" }),
        makeIssue({ code: "HTTP_STATUS", severity: "critical" }),
      ],
      60,
    );
    expect(recs[0].issueCode).toBe("HTTP_STATUS");
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
