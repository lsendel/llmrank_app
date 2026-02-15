import { describe, it, expect } from "vitest";
import { aggregateReportData, type RawDbResults } from "../data-aggregator";

function makeRawResults(overrides: Partial<RawDbResults> = {}): RawDbResults {
  return {
    project: { name: "Test Project", domain: "example.com" },
    crawl: {
      id: "crawl-1",
      completedAt: "2026-01-15T00:00:00Z",
      pagesFound: 10,
      pagesCrawled: 10,
      pagesScored: 10,
      summary: "Test summary",
    },
    pageScores: [
      {
        url: "https://example.com/",
        title: "Home",
        overallScore: 85,
        technicalScore: 90,
        contentScore: 80,
        aiReadinessScore: 85,
        lighthousePerf: 0.9,
        lighthouseSeo: 0.95,
        detail: null,
        issueCount: 2,
      },
      {
        url: "https://example.com/about",
        title: "About",
        overallScore: 70,
        technicalScore: 75,
        contentScore: 65,
        aiReadinessScore: 72,
        lighthousePerf: 0.7,
        lighthouseSeo: 0.8,
        detail: null,
        issueCount: 5,
      },
    ],
    issues: [
      {
        code: "MISSING_META_DESC",
        category: "technical",
        severity: "warning",
        message: "Missing meta description",
        recommendation: "Add a meta description",
      },
      {
        code: "MISSING_META_DESC",
        category: "technical",
        severity: "warning",
        message: "Missing meta description",
        recommendation: "Add a meta description",
      },
      {
        code: "MISSING_LLMS_TXT",
        category: "ai_readiness",
        severity: "critical",
        message: "No llms.txt found",
        recommendation: "Create llms.txt",
      },
    ],
    historyCrawls: [],
    visibilityChecks: [],
    ...overrides,
  };
}

describe("aggregateReportData", () => {
  it("computes correct average scores", () => {
    const result = aggregateReportData(makeRawResults(), { type: "summary" });
    expect(result.scores.overall).toBe(77.5);
    expect(result.scores.technical).toBe(82.5);
    expect(result.scores.content).toBe(72.5);
  });

  it("assigns correct letter grade", () => {
    const result = aggregateReportData(makeRawResults(), { type: "summary" });
    expect(result.scores.letterGrade).toBe("C");
  });

  it("computes grade distribution", () => {
    const result = aggregateReportData(makeRawResults(), { type: "summary" });
    const bGrade = result.gradeDistribution.find((g) => g.grade === "B");
    const cGrade = result.gradeDistribution.find((g) => g.grade === "C");
    expect(bGrade?.count).toBe(1);
    expect(cGrade?.count).toBe(1);
  });

  it("groups issues by severity and category", () => {
    const result = aggregateReportData(makeRawResults(), { type: "summary" });
    expect(result.issues.total).toBe(3);
    const warnings = result.issues.bySeverity.find(
      (s) => s.severity === "warning",
    );
    expect(warnings?.count).toBe(2);
    const critical = result.issues.bySeverity.find(
      (s) => s.severity === "critical",
    );
    expect(critical?.count).toBe(1);
  });

  it("deduplicates issues by code with counts", () => {
    const result = aggregateReportData(makeRawResults(), { type: "summary" });
    const metaIssue = result.issues.items.find(
      (i) => i.code === "MISSING_META_DESC",
    );
    expect(metaIssue?.affectedPages).toBe(2);
  });

  it("sorts issues critical-first", () => {
    const result = aggregateReportData(makeRawResults(), { type: "summary" });
    expect(result.issues.items[0].severity).toBe("critical");
  });

  it("generates quick wins from critical and warning issues", () => {
    const result = aggregateReportData(makeRawResults(), { type: "summary" });
    expect(result.quickWins.length).toBeGreaterThan(0);
    expect(result.quickWins[0].roi).toBeDefined();
  });

  it("sorts pages worst-first", () => {
    const result = aggregateReportData(makeRawResults(), { type: "summary" });
    expect(result.pages[0].overall).toBeLessThanOrEqual(
      result.pages[1].overall,
    );
  });

  it("returns null visibility when no checks exist", () => {
    const result = aggregateReportData(makeRawResults(), { type: "summary" });
    expect(result.visibility).toBeNull();
  });

  it("aggregates visibility checks correctly", () => {
    const result = aggregateReportData(
      makeRawResults({
        visibilityChecks: [
          {
            llmProvider: "chatgpt",
            brandMentioned: true,
            urlCited: false,
            citationPosition: null,
            competitorMentions: null,
            query: "test",
          },
          {
            llmProvider: "chatgpt",
            brandMentioned: false,
            urlCited: true,
            citationPosition: 2,
            competitorMentions: null,
            query: "other",
          },
        ],
      }),
      { type: "summary" },
    );
    expect(result.visibility).not.toBeNull();
    expect(result.visibility!.platforms[0].provider).toBe("chatgpt");
    expect(result.visibility!.platforms[0].brandMentionRate).toBe(50);
  });

  it("aggregates competitors from visibility checks", () => {
    const result = aggregateReportData(
      makeRawResults({
        visibilityChecks: [
          {
            llmProvider: "chatgpt",
            brandMentioned: false,
            urlCited: false,
            citationPosition: null,
            competitorMentions: [{ domain: "rival.com", mentioned: true }],
            query: "test query",
          },
        ],
      }),
      { type: "summary" },
    );
    expect(result.competitors).not.toBeNull();
    expect(result.competitors![0].domain).toBe("rival.com");
  });

  it("handles empty page scores gracefully", () => {
    const result = aggregateReportData(
      makeRawResults({ pageScores: [], issues: [] }),
      { type: "summary" },
    );
    expect(result.scores.overall).toBe(0);
    expect(result.scores.letterGrade).toBe("F");
    expect(result.pages).toHaveLength(0);
  });

  it("includes history crawls", () => {
    const result = aggregateReportData(
      makeRawResults({
        historyCrawls: [
          {
            id: "old-1",
            completedAt: "2025-12-01T00:00:00Z",
            pagesScored: 5,
            avgOverall: 60,
            avgTechnical: 65,
            avgContent: 55,
            avgAiReadiness: 62,
            avgPerformance: 58,
          },
        ],
      }),
      { type: "detailed" },
    );
    expect(result.history).toHaveLength(1);
    expect(result.history[0].overall).toBe(60);
  });
});
