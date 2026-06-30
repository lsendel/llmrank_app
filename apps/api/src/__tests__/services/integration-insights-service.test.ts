import { describe, it, expect, beforeEach, vi } from "vitest";
import { createIntegrationInsightsService } from "../../services/integration-insights-service";
import {
  createMockProjectRepo,
  createMockCrawlRepo,
  createMockEnrichmentRepo,
} from "../helpers/mock-repositories";
import { buildProject, buildCrawlJob } from "../helpers/factories";

describe("IntegrationInsightsService", () => {
  let projects: ReturnType<typeof createMockProjectRepo>;
  let crawls: ReturnType<typeof createMockCrawlRepo>;
  let enrichments: ReturnType<typeof createMockEnrichmentRepo>;

  beforeEach(() => {
    projects = createMockProjectRepo({
      getById: vi.fn().mockResolvedValue(buildProject({ id: "proj-1" })),
    });
    crawls = createMockCrawlRepo({
      listByProject: vi
        .fn()
        .mockResolvedValue([
          buildCrawlJob({ id: "crawl-1", projectId: "proj-1" }),
        ]),
      getById: vi
        .fn()
        .mockResolvedValue(
          buildCrawlJob({ id: "crawl-1", projectId: "proj-1" }),
        ),
    });
    enrichments = createMockEnrichmentRepo({
      listByJob: vi.fn().mockResolvedValue([]),
    });
  });

  it("returns null integrations when project has no crawls", async () => {
    crawls.listByProject.mockResolvedValue([]);
    const service = createIntegrationInsightsService({
      projects,
      crawls,
      enrichments,
    });
    const result = await service.getInsights("user-1", "proj-1");
    expect(result).toEqual({
      crawlId: null,
      crawlDate: null,
      integrations: null,
    });
  });

  it("returns empty integrations structure when crawl exists but no enrichments found", async () => {
    enrichments.listByJob.mockResolvedValue([]);
    const service = createIntegrationInsightsService({
      projects,
      crawls,
      enrichments,
    });
    const result = await service.getInsights("user-1", "proj-1");
    // Should return empty objects, not null, so the UI knows integrations are active but empty
    expect(result.integrations).toEqual({
      gsc: null,
      ga4: null,
      clarity: null,
      meta: null,
      psi: null,
      cloudflare: null,
    });
  });

  it("aggregates enrichments for the latest crawl", async () => {
    enrichments.listByJob.mockResolvedValue([
      {
        id: "enr-1",
        pageId: "page-1",
        jobId: "crawl-1",
        provider: "gsc",
        data: JSON.stringify({
          query: "ai seo",
          impressions: 120,
          clicks: 12,
          position: 2,
        }),
        fetchedAt: new Date().toISOString(),
      },
    ]);
    const service = createIntegrationInsightsService({
      projects,
      crawls,
      enrichments,
    });
    const result = await service.getInsights("user-1", "proj-1");
    expect(result.crawlId).toBe("crawl-1");
    expect(result.crawlDate).toBe("2024-01-01T00:00:00.000Z");
    expect(result.integrations?.gsc?.topQueries[0].query).toBe("ai seo");
  });

  it("prefers a completed crawl over an active crawl for default insights", async () => {
    crawls.listByProject.mockResolvedValue([
      buildCrawlJob({
        id: "crawl-active",
        projectId: "proj-1",
        status: "crawling",
        createdAt: "2024-01-02T00:00:00.000Z",
      }),
      buildCrawlJob({
        id: "crawl-complete",
        projectId: "proj-1",
        status: "complete",
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
    ]);
    enrichments.listByJob.mockImplementation(async (jobId: string) =>
      jobId === "crawl-complete"
        ? [
            {
              id: "enr-1",
              pageId: "page-1",
              jobId,
              provider: "gsc",
              data: JSON.stringify({
                query: "ai seo",
                impressions: 120,
                clicks: 12,
                position: 2,
              }),
              fetchedAt: new Date().toISOString(),
            },
          ]
        : [],
    );

    const service = createIntegrationInsightsService({
      projects,
      crawls,
      enrichments,
    });
    const result = await service.getInsights("user-1", "proj-1");

    expect(result.crawlId).toBe("crawl-complete");
    expect(result.integrations?.gsc?.topQueries[0].query).toBe("ai seo");
    expect(enrichments.listByJob).not.toHaveBeenCalledWith("crawl-active");
  });

  it("falls back to the latest completed crawl when no enrichments exist", async () => {
    crawls.listByProject.mockResolvedValue([
      buildCrawlJob({
        id: "crawl-active",
        projectId: "proj-1",
        status: "crawling",
        createdAt: "2024-01-02T00:00:00.000Z",
      }),
      buildCrawlJob({
        id: "crawl-complete",
        projectId: "proj-1",
        status: "complete",
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
    ]);
    enrichments.listByJob.mockResolvedValue([]);

    const service = createIntegrationInsightsService({
      projects,
      crawls,
      enrichments,
    });
    const result = await service.getInsights("user-1", "proj-1");

    expect(result.crawlId).toBe("crawl-complete");
    expect(result.integrations).toEqual({
      gsc: null,
      ga4: null,
      clarity: null,
      meta: null,
      psi: null,
      cloudflare: null,
    });
  });

  it("uses provided crawlId when available", async () => {
    const customCrawl = buildCrawlJob({ id: "crawl-2", projectId: "proj-1" });
    crawls.getById.mockResolvedValue(customCrawl);
    enrichments.listByJob.mockResolvedValue([]);
    const service = createIntegrationInsightsService({
      projects,
      crawls,
      enrichments,
    });
    const result = await service.getInsights("user-1", "proj-1", "crawl-2");
    expect(result.crawlId).toBe("crawl-2");
    expect(result.crawlDate).toBe("2024-01-01T00:00:00.000Z");
  });

  it("throws NOT_FOUND when crawl does not belong to project", async () => {
    crawls.getById.mockResolvedValue(buildCrawlJob({ projectId: "other" }));
    const service = createIntegrationInsightsService({
      projects,
      crawls,
      enrichments,
    });
    await expect(
      service.getInsights("user-1", "proj-1", "crawl-99"),
    ).rejects.toThrow("Crawl not found");
  });
});
