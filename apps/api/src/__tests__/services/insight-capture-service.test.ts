import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInsightCaptureService } from "../../services/insight-capture-service";

function createDeps() {
  return {
    crawlInsights: {
      replaceForCrawl: vi.fn().mockResolvedValue(undefined),
      listByCrawl: vi.fn(),
    },
    pageInsights: {
      replaceForCrawl: vi.fn().mockResolvedValue(undefined),
      listByCrawl: vi.fn(),
    },
  } as const;
}

describe("insightCaptureService", () => {
  let deps: ReturnType<typeof createDeps>;
  let service: ReturnType<typeof createInsightCaptureService>;

  beforeEach(() => {
    deps = createDeps();
    service = createInsightCaptureService(deps);
  });

  it("captures crawl and page insights", async () => {
    await service.capture({
      crawlId: "crawl-1",
      projectId: "proj-1",
      scores: [
        {
          id: "score-1",
          pageId: "page-1",
          overallScore: 82,
          technicalScore: 70,
          contentScore: 85,
          aiReadinessScore: 80,
          lighthousePerf: 0.9,
          platformScores: {
            chatgpt: { score: 75, tips: ["Add FAQ"] },
          },
        },
        {
          id: "score-2",
          pageId: "page-2",
          overallScore: 64,
          technicalScore: 60,
          contentScore: 58,
          aiReadinessScore: 55,
          lighthousePerf: 0.7,
          platformScores: {
            claude: { score: 50, tips: ["Improve content depth"] },
          },
        },
      ],
      issues: [
        {
          pageId: "page-1",
          code: "MISSING_TITLE",
          severity: "critical",
          category: "technical",
        },
        {
          pageId: "page-1",
          code: "THIN_CONTENT",
          severity: "warning",
          category: "content",
        },
        {
          pageId: "page-2",
          code: "NO_FOOTER",
          severity: "info",
          category: "content",
        },
      ],
      pages: [
        {
          id: "page-1",
          url: "https://example.com/",
          title: "Home",
          wordCount: 250,
        },
        {
          id: "page-2",
          url: "https://example.com/about",
          title: "About",
          wordCount: 120,
        },
      ],
    });

    expect(deps.crawlInsights.replaceForCrawl).toHaveBeenCalledTimes(1);
    const crawlRows = deps.crawlInsights.replaceForCrawl.mock.calls[0][1];
    expect(crawlRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "score_summary" }),
        expect.objectContaining({ type: "issue_distribution" }),
        expect.objectContaining({ type: "content_depth" }),
        expect.objectContaining({ type: "platform_readiness" }),
      ]),
    );

    expect(deps.pageInsights.replaceForCrawl).toHaveBeenCalledTimes(1);
    const pageRows = deps.pageInsights.replaceForCrawl.mock.calls[0][1];
    expect(pageRows).toHaveLength(2);
    expect(pageRows[0]).toEqual(
      expect.objectContaining({
        type: "page_hotspot",
        data: expect.objectContaining({ issueCount: expect.any(Number) }),
      }),
    );
  });
});
