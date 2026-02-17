import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPageService } from "../../services/page-service";
import {
  createMockProjectRepo,
  createMockCrawlRepo,
  createMockPageRepo,
  createMockScoreRepo,
  createMockEnrichmentRepo,
} from "../helpers/mock-repositories";
import { buildProject, buildCrawlJob, buildPage } from "../helpers/factories";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PageService", () => {
  let projects: ReturnType<typeof createMockProjectRepo>;
  let crawls: ReturnType<typeof createMockCrawlRepo>;
  let pages: ReturnType<typeof createMockPageRepo>;
  let scores: ReturnType<typeof createMockScoreRepo>;
  let enrichments: ReturnType<typeof createMockEnrichmentRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    projects = createMockProjectRepo({
      getById: vi.fn().mockResolvedValue(buildProject()),
    });
    crawls = createMockCrawlRepo({
      getById: vi.fn().mockResolvedValue(buildCrawlJob()),
    });
    pages = createMockPageRepo({
      getById: vi.fn().mockResolvedValue(
        buildPage({
          id: "page-1",
          projectId: "proj-1",
          url: "https://example.com/page1",
          title: "Test Page",
          wordCount: 500,
        }),
      ),
    });
    scores = createMockScoreRepo({
      getByPageWithIssues: vi.fn().mockResolvedValue({
        score: {
          overallScore: 85,
          technicalScore: 90,
          contentScore: 80,
          aiReadinessScore: 78,
          llmsTxtScore: null,
          robotsTxtScore: null,
          sitemapScore: null,
          schemaMarkupScore: null,
          metaTagsScore: null,
          botAccessScore: null,
          contentCiteabilityScore: null,
        },
        issues: [
          {
            id: "issue-1",
            jobId: "crawl-1",
            pageId: "page-1",
            code: "MISSING_CANONICAL",
            severity: "warning",
            category: "technical",
            message: "Missing canonical tag",
            recommendation: "Add canonical tag",
            data: {},
            createdAt: new Date(),
          },
        ],
        platformScores: null,
        recommendations: null,
      }),
      listByJobWithPages: vi.fn().mockResolvedValue([
        {
          id: "score-1",
          pageId: "page-1",
          jobId: "crawl-1",
          overallScore: 85,
          technicalScore: 90,
          contentScore: 80,
          aiReadinessScore: 78,
          llmsTxtScore: null,
          robotsTxtScore: null,
          sitemapScore: null,
          schemaMarkupScore: null,
          metaTagsScore: null,
          botAccessScore: null,
          contentCiteabilityScore: null,
          issueCount: 2,
          detail: { performanceScore: 70 },
          page: buildPage({
            id: "page-1",
            url: "https://example.com/page1",
            title: "Test Page",
            wordCount: 500,
          }),
          createdAt: new Date(),
          lighthousePerf: null,
          lighthouseSeo: null,
        },
      ]),
    });
    enrichments = createMockEnrichmentRepo();
  });

  describe("getPage", () => {
    it("returns page with score and issues", async () => {
      const service = createPageService({
        projects,
        crawls,
        pages,
        scores,
        enrichments,
      });

      const result = await service.getPage("user-1", "page-1");
      expect(result.id).toBe("page-1");
      expect(result.score).toBeDefined();
      expect(result.issues).toHaveLength(1);
    });

    it("throws NOT_FOUND when page does not exist", async () => {
      pages.getById.mockResolvedValue(undefined);
      const service = createPageService({
        projects,
        crawls,
        pages,
        scores,
        enrichments,
      });

      await expect(service.getPage("user-1", "page-999")).rejects.toThrow(
        "Page not found",
      );
    });

    it("throws NOT_FOUND when page belongs to another user", async () => {
      projects.getById.mockResolvedValue(
        buildProject({ userId: "other-user" }),
      );
      const service = createPageService({
        projects,
        crawls,
        pages,
        scores,
        enrichments,
      });

      await expect(service.getPage("user-1", "page-1")).rejects.toThrow(
        "Resource does not exist",
      );
    });
  });

  describe("listPagesForJob", () => {
    it("returns formatted page list with scores", async () => {
      const service = createPageService({
        projects,
        crawls,
        pages,
        scores,
        enrichments,
      });

      const result = await service.listPagesForJob("user-1", "crawl-1");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "page-1",
        crawlId: "crawl-1",
        overallScore: 85,
        technicalScore: 90,
        contentScore: 80,
        aiReadinessScore: 78,
        performanceScore: 70,
        letterGrade: "B",
        issueCount: 2,
      });
    });

    it("throws NOT_FOUND when crawl does not exist", async () => {
      crawls.getById.mockResolvedValue(undefined);
      const service = createPageService({
        projects,
        crawls,
        pages,
        scores,
        enrichments,
      });

      await expect(
        service.listPagesForJob("user-1", "crawl-999"),
      ).rejects.toThrow("Crawl not found");
    });

    it("throws NOT_FOUND when crawl belongs to another user", async () => {
      projects.getById.mockResolvedValue(
        buildProject({ userId: "other-user" }),
      );
      const service = createPageService({
        projects,
        crawls,
        pages,
        scores,
        enrichments,
      });

      await expect(
        service.listPagesForJob("user-1", "crawl-1"),
      ).rejects.toThrow("Resource does not exist");
    });

    it("handles rows with null page", async () => {
      scores.listByJobWithPages.mockResolvedValue([
        {
          id: "score-1",
          pageId: "page-1",
          jobId: "crawl-1",
          overallScore: 70,
          technicalScore: 75,
          contentScore: 65,
          aiReadinessScore: 60,
          llmsTxtScore: null,
          robotsTxtScore: null,
          sitemapScore: null,
          schemaMarkupScore: null,
          metaTagsScore: null,
          botAccessScore: null,
          contentCiteabilityScore: null,
          issueCount: 0,
          detail: {},
          platformScores: null,
          recommendations: null,
          createdAt: new Date(),
          lighthousePerf: null,
          lighthouseSeo: null,
          page: null,
        },
      ]);
      const service = createPageService({
        projects,
        crawls,
        pages,
        scores,
        enrichments,
      });

      const result = await service.listPagesForJob("user-1", "crawl-1");
      expect(result[0].id).toBe("page-1"); // falls back to row.pageId
      expect(result[0].performanceScore).toBeNull();
    });

    it("assigns correct letter grades based on score", async () => {
      scores.listByJobWithPages.mockResolvedValue([
        {
          id: "s-1",
          pageId: "p-1",
          jobId: "crawl-1",
          overallScore: 95,
          technicalScore: 95,
          contentScore: 95,
          aiReadinessScore: 95,
          llmsTxtScore: null,
          robotsTxtScore: null,
          sitemapScore: null,
          schemaMarkupScore: null,
          metaTagsScore: null,
          botAccessScore: null,
          contentCiteabilityScore: null,
          issueCount: 0,
          detail: { performanceScore: 95 },
          platformScores: null,
          recommendations: null,
          createdAt: new Date(),
          lighthousePerf: null,
          lighthouseSeo: null,
          page: buildPage({
            id: "p-1",
            url: "https://example.com/a",
            title: "A Page",
          }),
        },
        {
          id: "s-2",
          pageId: "p-2",
          jobId: "crawl-1",
          overallScore: 55,
          technicalScore: 50,
          contentScore: 55,
          aiReadinessScore: 50,
          llmsTxtScore: null,
          robotsTxtScore: null,
          sitemapScore: null,
          schemaMarkupScore: null,
          metaTagsScore: null,
          botAccessScore: null,
          contentCiteabilityScore: null,
          issueCount: 10,
          detail: { performanceScore: 40 },
          platformScores: null,
          recommendations: null,
          createdAt: new Date(),
          lighthousePerf: null,
          lighthouseSeo: null,
          page: buildPage({
            id: "p-2",
            url: "https://example.com/f",
            title: "F Page",
          }),
        },
      ]);
      const service = createPageService({
        projects,
        crawls,
        pages,
        scores,
        enrichments,
      });

      const result = await service.listPagesForJob("user-1", "crawl-1");
      expect(result[0].letterGrade).toBe("A");
      expect(result[1].letterGrade).toBe("F");
    });
  });

  describe("listIssues", () => {
    it("returns issues for a crawl job", async () => {
      const issues: any[] = [
        { code: "MISSING_TITLE", severity: "critical" },
        { code: "MISSING_ALT", severity: "warning" },
      ];
      scores.getIssuesByJob.mockResolvedValue(issues);
      const service = createPageService({
        projects,
        crawls,
        pages,
        scores,
        enrichments,
      });

      const result = await service.listIssues("user-1", "crawl-1");
      expect(result).toEqual(issues);
    });

    it("throws NOT_FOUND when crawl does not exist", async () => {
      crawls.getById.mockResolvedValue(undefined);
      const service = createPageService({
        projects,
        crawls,
        pages,
        scores,
        enrichments,
      });

      await expect(service.listIssues("user-1", "crawl-999")).rejects.toThrow(
        "Crawl not found",
      );
    });

    it("throws NOT_FOUND when crawl belongs to another user", async () => {
      projects.getById.mockResolvedValue(
        buildProject({ userId: "other-user" }),
      );
      const service = createPageService({
        projects,
        crawls,
        pages,
        scores,
        enrichments,
      });

      await expect(service.listIssues("user-1", "crawl-1")).rejects.toThrow(
        "Resource does not exist",
      );
    });
  });

  describe("listEnrichments", () => {
    it("returns enrichments for owned page", async () => {
      const enrichmentData = [
        {
          id: "enr-1",
          pageId: "page-1",
          jobId: "crawl-1",
          fetchedAt: new Date(),
          provider: "psi" as any,
          data: { score: 90 },
        },
      ];
      enrichments.listByPage.mockResolvedValue(enrichmentData);
      const service = createPageService({
        projects,
        crawls,
        pages,
        scores,
        enrichments,
      });

      const result = await service.listEnrichments("user-1", "page-1");
      expect(result).toEqual(enrichmentData);
    });

    it("throws NOT_FOUND when page does not exist", async () => {
      pages.getById.mockResolvedValue(undefined);
      const service = createPageService({
        projects,
        crawls,
        pages,
        scores,
        enrichments,
      });

      await expect(
        service.listEnrichments("user-1", "page-999"),
      ).rejects.toThrow("Page not found");
    });

    it("throws NOT_FOUND when page belongs to another user", async () => {
      projects.getById.mockResolvedValue(
        buildProject({ userId: "other-user" }),
      );
      const service = createPageService({
        projects,
        crawls,
        pages,
        scores,
        enrichments,
      });

      await expect(service.listEnrichments("user-1", "page-1")).rejects.toThrow(
        "Resource does not exist",
      );
    });
  });
});
