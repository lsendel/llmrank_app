import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Bindings } from "../../index";
import { ServiceError } from "../../services/errors";

const authMiddlewareMock = vi.hoisted(() =>
  vi.fn().mockImplementation(async (_c, next) => {
    await next();
  }),
);

const repoMocks = vi.hoisted(() => {
  const stub = vi.fn().mockReturnValue({});
  return {
    createCrawlRepository: stub,
    createProjectRepository: stub,
    createScoreRepository: stub,
    createPageRepository: stub,
    createEnrichmentRepository: stub,
    createVisibilityRepository: stub,
  };
});

const insightsServiceMocks = vi.hoisted(() => {
  const getInsights = vi.fn();
  const getIssueHeatmap = vi.fn();
  return {
    getInsights,
    getIssueHeatmap,
    createInsightsService: vi.fn(() => ({ getInsights, getIssueHeatmap })),
  };
});

const intelligenceServiceMocks = vi.hoisted(() => {
  const getFusedInsights = vi.fn();
  return {
    getFusedInsights,
    createIntelligenceService: vi.fn(() => ({ getFusedInsights })),
  };
});

vi.mock("../../middleware/auth", () => ({
  authMiddleware: authMiddlewareMock,
}));

vi.mock("../../repositories", () => repoMocks);

vi.mock("../../services/insights-service", () => ({
  createInsightsService: insightsServiceMocks.createInsightsService,
}));

vi.mock("../../services/intelligence-service", () => ({
  createIntelligenceService: intelligenceServiceMocks.createIntelligenceService,
}));

import { insightsRoutes } from "../../routes/insights";

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as any);
    c.set("userId", "user-1");
    await next();
  });
  app.route("/api/crawls", insightsRoutes);
  return app;
}

const baseEnv = {} as unknown as Bindings;

describe("insightsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns crawl insights with caching", async () => {
    insightsServiceMocks.getInsights.mockResolvedValue({ summary: [] });
    const app = createApp();

    const res = await app.fetch(
      new Request("http://localhost/api/crawls/crawl-1/insights"),
      baseEnv,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
    await expect(res.json()).resolves.toEqual({ data: { summary: [] } });
    expect(insightsServiceMocks.getInsights).toHaveBeenCalledWith(
      "user-1",
      "crawl-1",
    );
  });

  it("returns crawl issue heatmap", async () => {
    insightsServiceMocks.getIssueHeatmap.mockResolvedValue({ chart: [] });
    const app = createApp();

    const res = await app.fetch(
      new Request("http://localhost/api/crawls/crawl-1/issue-heatmap"),
      baseEnv,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
    await expect(res.json()).resolves.toEqual({ data: { chart: [] } });
    expect(insightsServiceMocks.getIssueHeatmap).toHaveBeenCalledWith(
      "user-1",
      "crawl-1",
    );
  });

  it("returns fused insights with shorter cache", async () => {
    intelligenceServiceMocks.getFusedInsights.mockResolvedValue({
      nodes: [],
    });
    const app = createApp();

    const res = await app.fetch(
      new Request("http://localhost/api/crawls/crawl-1/fused-insights"),
      baseEnv,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=300");
    await expect(res.json()).resolves.toEqual({ data: { nodes: [] } });
    expect(intelligenceServiceMocks.getFusedInsights).toHaveBeenCalledWith(
      "user-1",
      "crawl-1",
    );
  });

  it("maps service errors to JSON responses", async () => {
    const err = new ServiceError("NOT_FOUND", 404, "Missing crawl");
    intelligenceServiceMocks.getFusedInsights.mockRejectedValue(err);
    const app = createApp();

    const res = await app.fetch(
      new Request("http://localhost/api/crawls/missing/fused-insights"),
      baseEnv,
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Missing crawl",
        details: undefined,
      },
    });
  });
});
