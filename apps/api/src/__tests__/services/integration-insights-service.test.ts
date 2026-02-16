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
      getLatestByProject: vi
        .fn()
        .mockResolvedValue(
          buildCrawlJob({ id: "crawl-1", projectId: "proj-1" }),
        ),
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
    crawls.getLatestByProject.mockResolvedValue(undefined);
    const service = createIntegrationInsightsService({
      projects,
      crawls,
      enrichments,
    });
    const result = await service.getInsights("user-1", "proj-1");
    expect(result).toEqual({ crawlId: null, integrations: null });
  });

  it("aggregates enrichments for the latest crawl", async () => {
    enrichments.listByJob.mockResolvedValue([
      {
        id: "enr-1",
        pageId: "page-1",
        jobId: "crawl-1",
        provider: "gsc",
        data: { query: "ai seo", impressions: 120, clicks: 12, position: 2 },
        fetchedAt: new Date(),
      },
    ]);
    const service = createIntegrationInsightsService({
      projects,
      crawls,
      enrichments,
    });
    const result = await service.getInsights("user-1", "proj-1");
    expect(result.crawlId).toBe("crawl-1");
    expect(result.integrations?.gsc?.topQueries[0].query).toBe("ai seo");
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
