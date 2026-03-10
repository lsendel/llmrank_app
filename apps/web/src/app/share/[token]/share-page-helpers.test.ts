import { describe, expect, it } from "vitest";
import type { PublicReport } from "@/lib/api";
import {
  buildSharePageMetadata,
  getRecommendationDataLabel,
  getRecommendationMeta,
  getShareCategoryScores,
  getShareEvidencePages,
  getShareLevel,
  getShareScoreBgClass,
  getShareScoreTextClass,
} from "./share-page-helpers";

const report: PublicReport = {
  shareLevel: "full",
  crawlId: "crawl-1",
  projectId: "project-1",
  completedAt: "2026-03-07T00:00:00.000Z",
  pagesScored: 4,
  pagesCrawled: 6,
  summary: "Example summary",
  summaryData: null,
  project: { name: "Example", domain: "example.com", branding: null },
  scores: {
    overall: 82.6,
    technical: 80,
    content: 78,
    aiReadiness: 88,
    performance: 73,
    letterGrade: "B",
  },
  pages: [
    {
      url: "https://example.com",
      title: "Home",
      overallScore: 84,
      technicalScore: 82,
      contentScore: 80,
      aiReadinessScore: 86,
      issueCount: 3,
    },
  ],
  issueCount: 7,
  readinessCoverage: {},
  scoreDeltas: {
    overall: 4,
    technical: 0,
    content: -2,
    aiReadiness: 3,
    performance: 1,
  },
  quickWins: [
    {
      code: "MISSING_H1",
      category: "content",
      severity: "critical",
      scoreImpact: 12,
      effortLevel: "low",
      message: "Add a clear H1",
      recommendation: "Add a descriptive H1 to top landing pages.",
      affectedPages: 4,
    },
  ],
};

describe("share page helpers", () => {
  it("builds metadata and derived report data", () => {
    expect(buildSharePageMetadata(report).title).toBe(
      "example.com AI Readiness: B (83/100)",
    );
    expect(getShareLevel("issues")).toBe("issues");
    expect(getShareLevel("unexpected")).toBe("summary");
    expect(getShareEvidencePages(report)).toBe(6);
    expect(getShareCategoryScores(report).map((item) => item.label)).toEqual([
      "Technical SEO",
      "Content Quality",
      "AI Readiness",
      "Performance",
    ]);
  });

  it("derives recommendation fallback metadata and score styling", () => {
    const meta = getRecommendationMeta(
      report.quickWins[0],
      10,
      "2026-03-01T12:00:00.000Z",
    );

    expect(meta.confidence).toEqual({ label: "High", variant: "success" });
    expect(meta.dataTimestamp).toBe("2026-03-01T12:00:00.000Z");
    expect(getRecommendationDataLabel("invalid")).toBe("Data unavailable");
    expect(getRecommendationDataLabel(meta.dataTimestamp)).toBe(
      "Data Mar 1, 2026",
    );
    expect(getShareScoreBgClass(82)).toBe("bg-[#22c55e]");
    expect(getShareScoreTextClass(55)).toBe("text-[#f97316]");
  });
});
