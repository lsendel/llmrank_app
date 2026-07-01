import { describe, it, expect } from "vitest";
import {
  aggregateReportData,
  contentAssessedNote,
  type RawDbResults,
} from "../data-aggregator";

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
    expect(result.quickWins[0].pillar).toBeDefined();
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

  it("should handle null lighthouse data in performance average", () => {
    const result = aggregateReportData(
      makeRawResults({
        pageScores: [
          {
            url: "https://example.com/",
            title: "Home",
            overallScore: 85,
            technicalScore: 90,
            contentScore: 80,
            aiReadinessScore: 85,
            lighthousePerf: null,
            lighthouseSeo: null,
            detail: null,
            issueCount: 2,
          },
        ],
      }),
      { type: "summary" },
    );
    expect(result.scores.performance).toBeNull();
    expect(result.pages[0].performance).toBeNull();
  });

  it("should compute performance only from pages with lighthouse data", () => {
    const result = aggregateReportData(
      makeRawResults({
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
            lighthousePerf: null,
            lighthouseSeo: null,
            detail: null,
            issueCount: 5,
          },
        ],
      }),
      { type: "summary" },
    );
    // Only the first page has lighthouse data (0.9 + 0.95) / 2 * 100 = 92.5 → 93
    expect(result.scores.performance).toBe(93);
    expect(
      result.pages.find((p) => p.url === "https://example.com/about")
        ?.performance,
    ).toBeNull();
  });

  it("handles empty page scores gracefully", () => {
    const result = aggregateReportData(
      makeRawResults({ pageScores: [], issues: [] }),
      { type: "summary" },
    );
    expect(result.scores.overall).toBe(0);
    expect(result.scores.letterGrade).toBe("F");
    expect(result.pages).toHaveLength(0);
    expect(
      result.readinessCoverage.every((m) => m.coveragePercent === 100),
    ).toBe(true);
  });

  it("computes readiness coverage and action plan tiers", () => {
    const result = aggregateReportData(makeRawResults(), { type: "summary" });
    expect(result.readinessCoverage.length).toBeGreaterThan(0);
    expect(result.actionPlan.length).toBeGreaterThan(0);
  });

  it("splits content into assessed-vs-total under top-N LLM gating", () => {
    // Two pages: one LLM-assessed (contentScore 60), one unscored (inflated 90).
    // The legacy `content` averages both (75); `contentAssessed` reflects only the
    // assessed page (60) so the PDF doesn't overstate content quality (#114/#115).
    const result = aggregateReportData(
      makeRawResults({
        pageScores: [
          {
            url: "https://example.com/",
            title: "Home",
            overallScore: 70,
            technicalScore: 80,
            contentScore: 60,
            aiReadinessScore: 75,
            lighthousePerf: null,
            lighthouseSeo: null,
            detail: {
              llmContentScores: {
                clarity: 60,
                authority: 55,
                comprehensiveness: 62,
                structure: 58,
                citation_worthiness: 50,
              },
            },
            issueCount: 1,
          },
          {
            url: "https://example.com/unscored",
            title: "Unscored",
            overallScore: 92,
            technicalScore: 90,
            contentScore: 90,
            aiReadinessScore: 91,
            lighthousePerf: null,
            lighthouseSeo: null,
            detail: null,
            issueCount: 0,
          },
        ],
      }),
      { type: "detailed" },
    );
    expect(result.scores.content).toBe(75); // legacy avg over all pages
    expect(result.scores.contentAssessed).toBe(60); // assessed pages only
    expect(result.scores.assessedPages).toBe(1);
    expect(result.scores.totalPages).toBe(2);
  });

  it("reports contentAssessed=null and 0 assessed pages when none are LLM-scored", () => {
    const result = aggregateReportData(makeRawResults(), { type: "summary" });
    expect(result.scores.contentAssessed).toBeNull();
    expect(result.scores.assessedPages).toBe(0);
    expect(result.scores.totalPages).toBe(2);
  });

  describe("contentAssessedNote", () => {
    it("discloses the denominator + assessed avg on a partial gap", () => {
      expect(
        contentAssessedNote({
          contentAssessed: 60,
          assessedPages: 20,
          totalPages: 2000,
        }),
      ).toBe(
        "Content quality assessed on 20 of 2000 pages (assessed avg 60/100).",
      );
    });

    it("flags 'not yet assessed' when no page was LLM-scored", () => {
      const note = contentAssessedNote({
        contentAssessed: null,
        assessedPages: 0,
        totalPages: 500,
      });
      expect(note).toContain("not yet assessed");
    });

    it("returns null when every page was assessed (no inflation to disclose)", () => {
      expect(
        contentAssessedNote({
          contentAssessed: 72,
          assessedPages: 10,
          totalPages: 10,
        }),
      ).toBeNull();
    });

    it("returns null for an empty crawl", () => {
      expect(
        contentAssessedNote({
          contentAssessed: null,
          assessedPages: 0,
          totalPages: 0,
        }),
      ).toBeNull();
    });
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
          {
            id: "new-1",
            completedAt: "2026-01-01T00:00:00Z",
            pagesScored: 5,
            avgOverall: 80,
            avgTechnical: 78,
            avgContent: 75,
            avgAiReadiness: 82,
            avgPerformance: 84,
          },
        ],
      }),
      { type: "detailed" },
    );
    expect(result.history).toHaveLength(2);
    expect(result.history[0].overall).toBe(60);
    expect(result.scoreDeltas.overall).toBeGreaterThanOrEqual(0);
  });
});
