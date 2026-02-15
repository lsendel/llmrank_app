import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInsightsService } from "../../services/insights-service";
import {
  createMockCrawlRepo,
  createMockProjectRepo,
  createMockScoreRepo,
  createMockPageRepo,
} from "../helpers/mock-repositories";
import { buildProject, buildCrawlJob, buildScore } from "../helpers/factories";

describe("InsightsService", () => {
  let crawls: ReturnType<typeof createMockCrawlRepo>;
  let projects: ReturnType<typeof createMockProjectRepo>;
  let scores: ReturnType<typeof createMockScoreRepo>;
  let pages: ReturnType<typeof createMockPageRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    projects = createMockProjectRepo({
      getById: vi.fn().mockResolvedValue(buildProject()),
    });
    crawls = createMockCrawlRepo({
      getById: vi.fn().mockResolvedValue(
        buildCrawlJob({
          status: "complete",
          pagesFound: 10,
          pagesCrawled: 10,
          pagesScored: 10,
        }),
      ),
    });
    scores = createMockScoreRepo({
      listByJob: vi.fn().mockResolvedValue([
        buildScore({
          overallScore: 95,
          technicalScore: 90,
          contentScore: 85,
          aiReadinessScore: 92,
        }),
        buildScore({
          id: "s2",
          pageId: "p2",
          overallScore: 72,
          technicalScore: 65,
          contentScore: 70,
          aiReadinessScore: 68,
        }),
        buildScore({
          id: "s3",
          pageId: "p3",
          overallScore: 55,
          technicalScore: 50,
          contentScore: 60,
          aiReadinessScore: 45,
        }),
      ]),
      getIssuesByJob: vi.fn().mockResolvedValue([
        {
          id: "i1",
          pageId: "p1",
          jobId: "crawl-1",
          category: "technical",
          severity: "critical",
          code: "MISSING_TITLE",
          message: "m",
        },
        {
          id: "i2",
          pageId: "p2",
          jobId: "crawl-1",
          category: "content",
          severity: "warning",
          code: "LOW_WORD_COUNT",
          message: "m",
        },
        {
          id: "i3",
          pageId: "p2",
          jobId: "crawl-1",
          category: "technical",
          severity: "critical",
          code: "HTTP_ERROR",
          message: "m",
        },
      ]),
    });
    pages = createMockPageRepo({
      listByJob: vi.fn().mockResolvedValue([
        {
          id: "p1",
          jobId: "crawl-1",
          projectId: "proj-1",
          wordCount: 1200,
          url: "https://example.com/",
          canonicalUrl: null,
          statusCode: 200,
          title: "Home",
          metaDesc: null,
          contentHash: null,
          r2RawKey: null,
          r2LhKey: null,
          crawledAt: null,
          createdAt: new Date("2024-01-01"),
        },
        {
          id: "p2",
          jobId: "crawl-1",
          projectId: "proj-1",
          wordCount: 300,
          url: "https://example.com/about",
          canonicalUrl: null,
          statusCode: 200,
          title: "About",
          metaDesc: null,
          contentHash: null,
          r2RawKey: null,
          r2LhKey: null,
          crawledAt: null,
          createdAt: new Date("2024-01-01"),
        },
        {
          id: "p3",
          jobId: "crawl-1",
          projectId: "proj-1",
          wordCount: 800,
          url: "https://example.com/blog",
          canonicalUrl: null,
          statusCode: 200,
          title: "Blog",
          metaDesc: null,
          contentHash: null,
          r2RawKey: null,
          r2LhKey: null,
          crawledAt: null,
          createdAt: new Date("2024-01-01"),
        },
      ]),
    });
  });

  describe("getInsights", () => {
    it("returns issue distribution grouped by severity and category", async () => {
      const service = createInsightsService({
        crawls,
        projects,
        scores,
        pages,
      });
      const result = await service.getInsights("user-1", "crawl-1");

      expect(result.issueDistribution.total).toBe(3);
      expect(result.issueDistribution.bySeverity).toContainEqual({
        severity: "critical",
        count: 2,
      });
      expect(result.issueDistribution.bySeverity).toContainEqual({
        severity: "warning",
        count: 1,
      });
      expect(result.issueDistribution.byCategory).toContainEqual({
        category: "technical",
        count: 2,
      });
      expect(result.issueDistribution.byCategory).toContainEqual({
        category: "content",
        count: 1,
      });
    });

    it("returns grade distribution with correct letter grades", async () => {
      const service = createInsightsService({
        crawls,
        projects,
        scores,
        pages,
      });
      const result = await service.getInsights("user-1", "crawl-1");

      // 95 -> A, 72 -> C, 55 -> F
      const grades = result.gradeDistribution.map((g) => g.grade);
      expect(grades).toContain("A");
      expect(grades).toContain("C");
      expect(grades).toContain("F");
      expect(result.gradeDistribution.reduce((s, g) => s + g.count, 0)).toBe(3);
    });

    it("returns score radar with averages across all pages", async () => {
      const service = createInsightsService({
        crawls,
        projects,
        scores,
        pages,
      });
      const result = await service.getInsights("user-1", "crawl-1");

      // avg technical: (90+65+50)/3 ≈ 68.3
      expect(result.scoreRadar.technical).toBeCloseTo(68.3, 0);
      expect(result.scoreRadar.content).toBeCloseTo(71.7, 0);
    });

    it("returns content ratio with avg word count", async () => {
      const service = createInsightsService({
        crawls,
        projects,
        scores,
        pages,
      });
      const result = await service.getInsights("user-1", "crawl-1");

      // avg: (1200+300+800)/3 ≈ 766.7
      expect(result.contentRatio.avgWordCount).toBeCloseTo(766.7, 0);
      expect(result.contentRatio.totalPages).toBe(3);
    });

    it("returns crawl progress from job data", async () => {
      const service = createInsightsService({
        crawls,
        projects,
        scores,
        pages,
      });
      const result = await service.getInsights("user-1", "crawl-1");

      expect(result.crawlProgress.found).toBe(10);
      expect(result.crawlProgress.status).toBe("complete");
    });

    it("throws NOT_FOUND for non-existent crawl", async () => {
      crawls.getById.mockResolvedValue(undefined);
      const service = createInsightsService({
        crawls,
        projects,
        scores,
        pages,
      });
      await expect(service.getInsights("user-1", "crawl-1")).rejects.toThrow(
        "Crawl not found",
      );
    });

    it("throws NOT_FOUND if user does not own project", async () => {
      projects.getById.mockResolvedValue(
        buildProject({ userId: "other-user" }),
      );
      const service = createInsightsService({
        crawls,
        projects,
        scores,
        pages,
      });
      await expect(service.getInsights("user-1", "crawl-1")).rejects.toThrow();
    });
  });

  describe("getIssueHeatmap", () => {
    it("returns pages with per-category issue severity", async () => {
      const service = createInsightsService({
        crawls,
        projects,
        scores,
        pages,
      });
      const result = await service.getIssueHeatmap("user-1", "crawl-1");

      expect(result.categories).toContain("technical");
      expect(result.categories).toContain("content");
      expect(result.pages.length).toBeGreaterThan(0);

      const page2 = result.pages.find((p) => p.pageId === "p2");
      expect(page2?.issues.technical).toBe("critical");
      expect(page2?.issues.content).toBe("warning");
    });
  });
});
