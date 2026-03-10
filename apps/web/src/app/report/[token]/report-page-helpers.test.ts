import { describe, expect, it } from "vitest";
import type { SharedReport } from "@/lib/api";
import {
  formatReportDate,
  getReportBrandColor,
  getReportCategoryScores,
  getReportCoverageHighlights,
  getReportDeltaRows,
  getReportEvidencePages,
  getReportRecommendationDataLabel,
  getReportRecommendationMeta,
  isAgencySharedReport,
} from "./report-page-helpers";

const report: SharedReport = {
  crawlId: "crawl-12345678",
  projectId: "project-1",
  completedAt: "2026-03-07T12:00:00.000Z",
  pagesScored: 12,
  pagesCrawled: 14,
  summary: "Example summary",
  summaryData: null,
  project: {
    name: "Example Project",
    domain: "example.com",
    branding: {
      companyName: "Example Agency",
      primaryColor: "#123456",
    },
  },
  scores: {
    overall: 82,
    technical: 79,
    content: 76,
    aiReadiness: 90,
    performance: 71,
    letterGrade: "B",
  },
  pages: [
    {
      url: "https://example.com",
      title: "Home",
      overallScore: 84,
      technicalScore: 82,
      contentScore: 80,
      aiReadinessScore: 88,
      issueCount: 3,
    },
  ],
  issueCount: 7,
  quickWins: [
    {
      code: "MISSING_H1",
      category: "content",
      severity: "critical",
      scoreImpact: 12,
      effortLevel: "low",
      message: "Add a clear H1",
      recommendation: "Add a descriptive H1 to top landing pages.",
      priority: 1,
      affectedPages: 4,
    },
  ],
  readinessCoverage: [
    {
      code: "llms-txt",
      label: "LLMs.txt coverage",
      description: "Coverage description",
      pillar: "technical",
      coveragePercent: 75,
      affectedPages: 3,
      totalPages: 12,
    },
    {
      code: "schema",
      label: "Schema coverage",
      description: "Schema description",
      pillar: "technical",
      coveragePercent: 50,
      affectedPages: 6,
      totalPages: 12,
    },
  ],
  scoreDeltas: {
    overall: 4,
    technical: 1,
    content: -2,
    aiReadiness: 3,
    performance: 0,
  },
};

describe("report page helpers", () => {
  it("derives recommendation metadata and report labels", () => {
    const meta = getReportRecommendationMeta(
      report.quickWins[0],
      12,
      "2026-03-01T12:00:00.000Z",
    );

    expect(meta.confidence).toEqual({ label: "High", variant: "success" });
    expect(meta.dataTimestamp).toBe("2026-03-01T12:00:00.000Z");
    expect(getReportRecommendationDataLabel(meta.dataTimestamp)).toBe(
      "Data Mar 1, 2026",
    );
    expect(getReportRecommendationDataLabel("invalid")).toBe(
      "Data unavailable",
    );
    expect(formatReportDate(report.completedAt)).toBe("Mar 7, 2026");
  });

  it("derives branded shared-report summary data", () => {
    expect(getReportBrandColor(report)).toBe("#123456");
    expect(isAgencySharedReport(report)).toBe(true);
    expect(getReportEvidencePages(report)).toBe(12);
    expect(getReportCoverageHighlights(report)).toHaveLength(2);
    expect(getReportDeltaRows(report)).toEqual([
      { label: "Overall", value: 4 },
      { label: "Technical", value: 1 },
      { label: "Content", value: -2 },
      { label: "AI Readiness", value: 3 },
      { label: "Performance", value: 0 },
    ]);
    expect(getReportCategoryScores(report).map((item) => item.label)).toEqual([
      "Technical SEO",
      "Content Quality",
      "AI Readiness",
      "Performance",
    ]);
  });
});
