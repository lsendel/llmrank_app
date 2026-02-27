import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStrategyService } from "../../services/strategy-service";
import {
  createMockProjectRepo,
  createMockCompetitorRepo,
  createMockPageRepo,
  createMockScoreRepo,
  createMockCrawlRepo,
} from "../helpers/mock-repositories";
import { buildProject, buildCrawlJob, buildPage } from "../helpers/factories";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@llm-boost/scoring", () => ({
  clusterPagesByTopic: vi.fn().mockReturnValue([
    {
      label: "Blog",
      keywords: ["blog", "article"],
      pages: [{ url: "https://example.com/blog" }],
    },
  ]),
}));

vi.mock("@llm-boost/llm", () => ({
  PersonaGenerator: vi.fn().mockImplementation(() => ({
    generatePersonas: vi
      .fn()
      .mockResolvedValue([
        { name: "Developer", queries: ["how to build api"] },
      ]),
  })),
  StrategyOptimizer: vi.fn().mockImplementation(() => ({
    rewriteForAIVisibility: vi.fn().mockResolvedValue({ rewritten: "content" }),
    generateContentBrief: vi.fn().mockResolvedValue({ brief: "plan" }),
    analyzeStructuralGap: vi.fn().mockResolvedValue({ gaps: [] }),
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StrategyService", () => {
  let projects: ReturnType<typeof createMockProjectRepo>;
  let competitors: ReturnType<typeof createMockCompetitorRepo>;
  let pages: ReturnType<typeof createMockPageRepo>;
  let scores: ReturnType<typeof createMockScoreRepo>;
  let crawls: ReturnType<typeof createMockCrawlRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    projects = createMockProjectRepo({
      getById: vi.fn().mockResolvedValue(buildProject()),
    });
    competitors = createMockCompetitorRepo();
    pages = createMockPageRepo();
    scores = createMockScoreRepo({
      listByJobWithPages: vi.fn().mockResolvedValue([
        {
          id: "score-1",
          overallScore: 85,
          page: buildPage({
            url: "https://example.com/blog",
            title: "Blog",
            wordCount: 1000,
          }),
          detail: {
            extracted: { h1: ["Blog"], h2: ["Intro"], internal_links: [] },
          },
        },
      ]),
    });
    crawls = createMockCrawlRepo({
      getLatestByProject: vi.fn().mockResolvedValue(buildCrawlJob()),
    });
  });

  it("returns topic map for owned project", async () => {
    const service = createStrategyService({
      projects,
      competitors,
      pages,
      scores,
      crawls,
    });

    const result = await service.getTopicMap("user-1", "proj-1");
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      id: "https://example.com/blog",
      score: 85,
    });
    expect(result.clusters).toHaveLength(1);
  });

  it("throws NOT_FOUND when project is not owned by user", async () => {
    projects.getById.mockResolvedValue(buildProject({ userId: "other-user" }));
    const service = createStrategyService({
      projects,
      competitors,
      pages,
      scores,
      crawls,
    });

    await expect(service.getTopicMap("user-1", "proj-1")).rejects.toThrow(
      "Resource does not exist",
    );
  });

  it("returns empty graph when no scores exist", async () => {
    scores.listByJobWithPages.mockResolvedValue([]);
    const service = createStrategyService({
      projects,
      competitors,
      pages,
      scores,
      crawls,
    });

    const result = await service.getTopicMap("user-1", "proj-1");
    expect(result).toEqual({ nodes: [], edges: [] });
  });

  it("throws NOT_FOUND when no crawls exist", async () => {
    crawls.getLatestByProject.mockResolvedValue(undefined);
    const service = createStrategyService({
      projects,
      competitors,
      pages,
      scores,
      crawls,
    });

    await expect(service.getTopicMap("user-1", "proj-1")).rejects.toThrow(
      "No crawls found",
    );
  });

  it("lists competitors for owned project", async () => {
    const compList: any[] = [
      {
        id: "comp-1",
        domain: "rival.com",
        projectId: "proj-1",
        createdAt: new Date(),
      },
    ];
    competitors.listByProject.mockResolvedValue(compList);
    const service = createStrategyService({
      projects,
      competitors,
      pages,
      scores,
      crawls,
    });

    const result = await service.listCompetitors("user-1", "proj-1");
    expect(result).toEqual(compList);
  });

  // ---- optimize ----

  describe("optimize", () => {
    it("rewrites content for AI visibility", async () => {
      pages.getById.mockResolvedValue(
        buildPage({
          id: "page-1",
          projectId: "proj-1",
          url: "https://example.com/page1",
          title: "Test",
        }),
      );
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      const result = await service.optimize(
        "user-1",
        "page-1",
        "some content",
        "sk-key",
      );
      expect(result).toEqual({ rewritten: "content" });
    });

    it("throws NOT_FOUND when page does not exist", async () => {
      pages.getById.mockResolvedValue(undefined);
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      await expect(
        service.optimize("user-1", "page-999", "content", "sk-key"),
      ).rejects.toThrow("Page not found");
    });

    it("throws NOT_FOUND when page belongs to another user's project", async () => {
      pages.getById.mockResolvedValue(
        buildPage({
          id: "page-1",
          projectId: "proj-1",
        }),
      );
      projects.getById.mockResolvedValue(
        buildProject({ userId: "other-user" }),
      );
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      await expect(
        service.optimize("user-1", "page-1", "content", "sk-key"),
      ).rejects.toThrow("Resource does not exist");
    });
  });

  // ---- brief ----

  describe("brief", () => {
    it("generates a content brief for a keyword", async () => {
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      const result = await service.brief("ai seo tools", "sk-key");
      expect(result).toEqual({ brief: "plan" });
    });
  });

  // ---- gapAnalysis ----

  describe("gapAnalysis", () => {
    it("runs gap analysis for a project", async () => {
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      const result = await service.gapAnalysis({
        userId: "user-1",
        projectId: "proj-1",
        competitorDomain: "competitor.com",
        query: "best api tools",
        apiKey: "sk-key",
      });
      expect(result).toEqual({ gaps: [] });
    });

    it("includes page data when pageId is provided", async () => {
      pages.getById.mockResolvedValue(
        buildPage({
          id: "page-1",
          projectId: "proj-1",
          title: "My API Page",
          wordCount: 1500,
        }),
      );
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      await service.gapAnalysis({
        userId: "user-1",
        projectId: "proj-1",
        competitorDomain: "competitor.com",
        query: "api tools",
        apiKey: "sk-key",
        pageId: "page-1",
      });

      // Should complete without errors
      expect(pages.getById).toHaveBeenCalledWith("page-1");
    });

    it("throws NOT_FOUND when pageId provided but page not found", async () => {
      pages.getById.mockResolvedValue(undefined);
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      await expect(
        service.gapAnalysis({
          userId: "user-1",
          projectId: "proj-1",
          competitorDomain: "competitor.com",
          query: "api",
          apiKey: "sk-key",
          pageId: "page-missing",
        }),
      ).rejects.toThrow("Page not found");
    });

    it("throws NOT_FOUND when page belongs to different project", async () => {
      pages.getById.mockResolvedValue(
        buildPage({
          id: "page-1",
          projectId: "other-proj",
          title: "Other",
          wordCount: 100,
        }),
      );
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      await expect(
        service.gapAnalysis({
          userId: "user-1",
          projectId: "proj-1",
          competitorDomain: "competitor.com",
          query: "api",
          apiKey: "sk-key",
          pageId: "page-1",
        }),
      ).rejects.toThrow("Page not found");
    });
  });

  // ---- personas ----

  describe("personas", () => {
    it("generates personas for a project", async () => {
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      const result = await service.personas(
        "user-1",
        "proj-1",
        { description: "API platform", niche: "Developer Tools" },
        "sk-key",
      );
      expect(result).toEqual([
        { name: "Developer", queries: ["how to build api"] },
      ]);
    });

    it("throws CONFIG_ERROR when apiKey is empty", async () => {
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      await expect(
        service.personas("user-1", "proj-1", {}, ""),
      ).rejects.toThrow("AI service not configured");
    });

    it("uses project name and General niche as defaults", async () => {
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      await service.personas("user-1", "proj-1", {}, "sk-key");
      // Should complete without errors using defaults
    });
  });

  // ---- addCompetitor ----

  describe("addCompetitor", () => {
    it("adds a competitor to the project", async () => {
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      await service.addCompetitor("user-1", "proj-1", "rival.com");
      expect(competitors.add).toHaveBeenCalledWith("proj-1", "rival.com");
    });

    it("throws NOT_FOUND when project not owned", async () => {
      projects.getById.mockResolvedValue(
        buildProject({ userId: "other-user" }),
      );
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      await expect(
        service.addCompetitor("user-1", "proj-1", "rival.com"),
      ).rejects.toThrow("Resource does not exist");
    });
  });

  // ---- removeCompetitor ----

  describe("removeCompetitor", () => {
    it("removes a competitor", async () => {
      competitors.getById.mockResolvedValue({
        id: "comp-1",
        projectId: "proj-1",
        domain: "rival.com",
        source: "user_added",
        monitoringEnabled: true,
        monitoringFrequency: "weekly" as const,
        nextBenchmarkAt: null,
        lastBenchmarkAt: null,
        createdAt: new Date("2024-01-01"),
      });
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      const result = await service.removeCompetitor("user-1", "comp-1");
      expect(result).toEqual({ id: "comp-1", deleted: true });
      expect(competitors.remove).toHaveBeenCalledWith("comp-1");
    });

    it("throws NOT_FOUND when competitor does not exist", async () => {
      competitors.getById.mockResolvedValue(null as any);
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      await expect(
        service.removeCompetitor("user-1", "comp-999"),
      ).rejects.toThrow("Competitor not found");
    });

    it("throws NOT_FOUND when competitor belongs to another user's project", async () => {
      competitors.getById.mockResolvedValue({
        id: "comp-1",
        projectId: "proj-1",
        domain: "rival.com",
        source: "user_added",
        monitoringEnabled: true,
        monitoringFrequency: "weekly" as const,
        nextBenchmarkAt: null,
        lastBenchmarkAt: null,
        createdAt: new Date("2024-01-01"),
      });
      projects.getById.mockResolvedValue(
        buildProject({ userId: "other-user" }),
      );
      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      await expect(
        service.removeCompetitor("user-1", "comp-1"),
      ).rejects.toThrow("Resource does not exist");
    });
  });

  // ---- getTopicMap edges ----

  describe("getTopicMap edges", () => {
    it("builds edges from internal links within crawled pages", async () => {
      scores.listByJobWithPages.mockResolvedValue([
        {
          id: "s-1",
          overallScore: 85,
          page: {
            url: "https://example.com/page-a",
            title: "Page A",
            wordCount: 1000,
          } as any,
          detail: {
            extracted: {
              h1: ["Page A"],
              h2: [],
              internal_links: ["https://example.com/page-b"],
            },
          },
        } as any,
        {
          id: "s-2",
          overallScore: 75,
          page: {
            url: "https://example.com/page-b",
            title: "Page B",
            wordCount: 800,
          } as any,
          detail: {
            extracted: {
              h1: ["Page B"],
              h2: [],
              internal_links: [],
            },
          },
        } as any,
      ]);

      const { clusterPagesByTopic } = await import("@llm-boost/scoring");
      (clusterPagesByTopic as ReturnType<typeof vi.fn>).mockReturnValue([
        {
          label: "Content",
          keywords: ["page"],
          pages: [
            { url: "https://example.com/page-a" },
            { url: "https://example.com/page-b" },
          ],
        },
      ]);

      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      const result = await service.getTopicMap("user-1", "proj-1");
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toEqual({
        source: "https://example.com/page-a",
        target: "https://example.com/page-b",
        weight: 1,
      });
    });

    it("excludes self-links from edges", async () => {
      scores.listByJobWithPages.mockResolvedValue([
        {
          id: "s-1",
          overallScore: 85,
          page: {
            url: "https://example.com/page-a",
            title: "Page A",
            wordCount: 1000,
          } as any,
          detail: {
            extracted: {
              h1: [],
              h2: [],
              internal_links: ["https://example.com/page-a"], // self-link
            },
          },
        } as any,
      ]);

      const { clusterPagesByTopic } = await import("@llm-boost/scoring");
      (clusterPagesByTopic as ReturnType<typeof vi.fn>).mockReturnValue([
        {
          label: "Blog",
          keywords: ["blog"],
          pages: [{ url: "https://example.com/page-a" }],
        },
      ]);

      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      const result = await service.getTopicMap("user-1", "proj-1");
      expect(result.edges).toHaveLength(0);
    });

    it("excludes links to pages not in the crawl", async () => {
      scores.listByJobWithPages.mockResolvedValue([
        {
          id: "s-1",
          overallScore: 85,
          page: {
            url: "https://example.com/page-a",
            title: "Page A",
            wordCount: 1000,
          } as any,
          detail: {
            extracted: {
              h1: [],
              h2: [],
              internal_links: ["https://example.com/external-page"],
            },
          },
        } as any,
      ]);

      const { clusterPagesByTopic } = await import("@llm-boost/scoring");
      (clusterPagesByTopic as ReturnType<typeof vi.fn>).mockReturnValue([
        {
          label: "Blog",
          keywords: ["blog"],
          pages: [{ url: "https://example.com/page-a" }],
        },
      ]);

      const service = createStrategyService({
        projects,
        competitors,
        pages,
        scores,
        crawls,
      });

      const result = await service.getTopicMap("user-1", "proj-1");
      expect(result.edges).toHaveLength(0);
    });
  });
});
