import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetById = vi.fn();
const mockListByUser = vi.fn();
const mockGetLatestByProject = vi.fn();
const mockGetLatestByProjects = vi.fn();
const mockListCompletedByProject = vi.fn();
const mockGetIssuesByJob = vi.fn();
const mockListByJobs = vi.fn();
const mockCountByProject = vi.fn();
const mockCountByProjects = vi.fn();
const mockListByProject = vi.fn();
const mockListByProjects = vi.fn();
const mockGetLatestPipeline = vi.fn();

vi.mock("@llm-boost/db", () => ({
  projectQueries: () => ({
    getById: mockGetById,
    listByUser: mockListByUser,
  }),
  crawlQueries: () => ({
    getLatestByProject: mockGetLatestByProject,
    getLatestByProjects: mockGetLatestByProjects,
    listCompletedByProject: mockListCompletedByProject,
  }),
  scoreQueries: () => ({
    getIssuesByJob: mockGetIssuesByJob,
    listByJobs: mockListByJobs,
  }),
  savedKeywordQueries: () => ({
    countByProject: mockCountByProject,
    countByProjects: mockCountByProjects,
  }),
  competitorQueries: () => ({
    listByProject: mockListByProject,
    listByProjects: mockListByProjects,
  }),
  pipelineRunQueries: () => ({ getLatestByProject: mockGetLatestPipeline }),
}));

import { createRecommendationsService } from "@llm-boost/pipeline";

describe("createRecommendationsService", () => {
  const fakeDb = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockListCompletedByProject.mockResolvedValue([]);
    mockListByJobs.mockResolvedValue([]);
  });

  it("returns critical crawl recommendation when no crawl exists", async () => {
    mockGetById.mockResolvedValueOnce({ id: "proj-1", userId: "u-1" });
    mockGetLatestByProject.mockResolvedValueOnce(null);

    const service = createRecommendationsService(fakeDb);
    const recs = await service.getForProject("proj-1");

    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({
      priority: "critical",
      category: "crawl",
      action: "start_crawl",
    });
  });

  it("returns empty when project not found", async () => {
    mockGetById.mockResolvedValueOnce(null);

    const service = createRecommendationsService(fakeDb);
    const recs = await service.getForProject("missing");

    expect(recs).toEqual([]);
  });

  it("detects stale crawl, low keywords, no competitors, no pipeline", async () => {
    mockGetById.mockResolvedValueOnce({ id: "proj-1", userId: "u-1" });
    mockGetLatestByProject.mockResolvedValueOnce({
      id: "crawl-1",
      status: "complete",
      completedAt: new Date(Date.now() - 20 * 86400000), // 20 days ago
    });
    mockGetIssuesByJob.mockResolvedValueOnce([]);
    mockCountByProject.mockResolvedValueOnce(2);
    mockListByProject.mockResolvedValueOnce([]);
    mockGetLatestPipeline.mockResolvedValueOnce(null);

    const service = createRecommendationsService(fakeDb);
    const recs = await service.getForProject("proj-1");

    const categories = recs.map((r) => r.category);
    expect(categories).toContain("keywords");
    expect(categories).toContain("competitors");
    expect(categories).toContain("pipeline");
    expect(categories).toContain("crawl");
  });

  it("detects critical issues", async () => {
    mockGetById.mockResolvedValueOnce({ id: "proj-1", userId: "u-1" });
    mockGetLatestByProject.mockResolvedValueOnce({
      id: "crawl-1",
      status: "complete",
      completedAt: new Date(), // fresh crawl
    });
    mockGetIssuesByJob.mockResolvedValueOnce([
      { severity: "critical", message: "AI crawlers blocked" },
      { severity: "critical", message: "Missing llms.txt" },
      { severity: "warning", message: "Thin content" },
    ]);
    mockCountByProject.mockResolvedValueOnce(10);
    mockListByProject.mockResolvedValueOnce([{ id: "comp-1" }]);
    mockGetLatestPipeline.mockResolvedValueOnce({ id: "run-1" });

    const service = createRecommendationsService(fakeDb);
    const recs = await service.getForProject("proj-1");

    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({
      priority: "critical",
      category: "issues",
      title: "2 critical issues found",
    });
    expect(recs[0].description).toBe(
      "AI crawlers blocked (1 page); Missing llms.txt (1 page)",
    );
  });

  it("recommends high-volume warning batches even when critical issues exist", async () => {
    mockGetById.mockResolvedValueOnce({ id: "proj-1", userId: "u-1" });
    mockGetLatestByProject.mockResolvedValueOnce({
      id: "crawl-1",
      status: "complete",
      completedAt: new Date(),
    });
    mockGetIssuesByJob.mockResolvedValueOnce([
      {
        severity: "critical",
        code: "HTTP_STATUS",
        message: "Page returned HTTP 404",
      },
      {
        severity: "critical",
        code: "HTTP_STATUS",
        message: "Page returned HTTP 404",
      },
      ...Array.from({ length: 8 }, () => ({
        severity: "warning",
        code: "LOW_READING_EASE",
        message: "Content readability is below recommended level",
        scoreImpact: -10,
      })),
      ...Array.from({ length: 4 }, () => ({
        severity: "warning",
        code: "NO_DIRECT_ANSWERS",
        message: "Content does not contain direct answers",
        scoreImpact: -12,
      })),
    ]);
    mockCountByProject.mockResolvedValueOnce(10);
    mockListByProject.mockResolvedValueOnce([{ id: "comp-1" }]);
    mockGetLatestPipeline.mockResolvedValueOnce({ id: "run-1" });

    const service = createRecommendationsService(fakeDb);
    const recs = await service.getForProject("proj-1");

    expect(recs).toHaveLength(2);
    expect(recs[0]).toMatchObject({
      priority: "critical",
      title: "2 critical issues found",
      description: "HTTP_STATUS: Page returned HTTP 404 (2 pages)",
    });
    expect(recs[1]).toMatchObject({
      priority: "high",
      category: "issues",
      title: "12 warning issues need batch fixes",
      description:
        "Batch by issue code or page template: LOW_READING_EASE: Content readability is below recommended level (8 pages); NO_DIRECT_ANSWERS: Content does not contain direct answers (4 pages)",
    });
  });

  it("sorts by priority (critical first)", async () => {
    mockGetById.mockResolvedValueOnce({ id: "proj-1", userId: "u-1" });
    mockGetLatestByProject.mockResolvedValueOnce({
      id: "crawl-1",
      status: "complete",
      completedAt: new Date(Date.now() - 20 * 86400000),
    });
    mockGetIssuesByJob.mockResolvedValueOnce([
      { severity: "critical", message: "Blocked" },
    ]);
    mockCountByProject.mockResolvedValueOnce(1);
    mockListByProject.mockResolvedValueOnce([]);
    mockGetLatestPipeline.mockResolvedValueOnce(null);

    const service = createRecommendationsService(fakeDb);
    const recs = await service.getForProject("proj-1");

    expect(recs[0].priority).toBe("critical");
    // Verify ordering: all critical before high before medium
    for (let i = 1; i < recs.length; i++) {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      expect(order[recs[i].priority]).toBeGreaterThanOrEqual(
        order[recs[i - 1].priority],
      );
    }
  });

  it("builds portfolio priority feed with freshness and source metadata", async () => {
    mockListByUser.mockResolvedValueOnce([
      { id: "proj-a", name: "A", domain: "a.com" },
      { id: "proj-b", name: "B", domain: "b.com" },
    ]);
    mockGetLatestByProjects.mockResolvedValueOnce([
      {
        id: "crawl-a",
        projectId: "proj-a",
        status: "complete",
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ]);
    mockGetIssuesByJob.mockResolvedValueOnce([
      { severity: "critical", message: "AI crawlers blocked" },
    ]);
    mockListCompletedByProject.mockResolvedValueOnce([
      { id: "crawl-a" },
      { id: "crawl-a-prev" },
    ]);
    mockListByJobs.mockResolvedValueOnce([
      { jobId: "crawl-a", overallScore: 88 },
      { jobId: "crawl-a-prev", overallScore: 74 },
    ]);
    mockCountByProjects.mockResolvedValueOnce(
      new Map([
        ["proj-a", 8],
        ["proj-b", 0],
      ]),
    );
    mockListByProjects.mockResolvedValueOnce([
      { id: "comp-1", projectId: "proj-a" },
    ]);

    const service = createRecommendationsService(fakeDb);
    const feed = await service.getPortfolioPriorityFeed("u-1", { limit: 10 });

    expect(feed).toHaveLength(2);
    expect(feed[0]).toMatchObject({
      projectId: "proj-b",
      category: "onboarding",
      priority: "critical",
    });
    expect(feed[1]).toMatchObject({
      projectId: "proj-a",
      category: "issues",
      priority: "critical",
      trendDelta: 14,
    });
    expect(feed[1].source.signals).toEqual(
      expect.arrayContaining([
        "issue_severity",
        "issue_count",
        "score_trend_delta",
      ]),
    );
    expect(feed[1].freshness.generatedAt).toBeTruthy();
  });

  it("ranks same-priority items using trend delta when impact/confidence/effort are similar", async () => {
    mockListByUser.mockResolvedValueOnce([
      { id: "proj-drop", name: "Drop", domain: "drop.com" },
      { id: "proj-up", name: "Up", domain: "up.com" },
    ]);
    mockGetLatestByProjects.mockResolvedValueOnce([
      {
        id: "crawl-drop",
        projectId: "proj-drop",
        status: "complete",
        completedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: "crawl-up",
        projectId: "proj-up",
        status: "complete",
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ]);

    mockGetIssuesByJob
      .mockResolvedValueOnce([
        { severity: "warning", message: "Issue A1" },
        { severity: "warning", message: "Issue A2" },
      ])
      .mockResolvedValueOnce([
        { severity: "warning", message: "Issue B1" },
        { severity: "warning", message: "Issue B2" },
      ]);
    mockCountByProjects.mockResolvedValue(
      new Map([
        ["proj-drop", 10],
        ["proj-up", 10],
      ]),
    );
    mockListByProjects.mockResolvedValue([
      { id: "comp-1", projectId: "proj-drop" },
      { id: "comp-2", projectId: "proj-up" },
    ]);

    mockListCompletedByProject
      .mockResolvedValueOnce([{ id: "crawl-drop" }, { id: "crawl-drop-prev" }])
      .mockResolvedValueOnce([{ id: "crawl-up" }, { id: "crawl-up-prev" }]);
    mockListByJobs
      .mockResolvedValueOnce([
        { jobId: "crawl-drop", overallScore: 58 },
        { jobId: "crawl-drop-prev", overallScore: 74 },
      ])
      .mockResolvedValueOnce([
        { jobId: "crawl-up", overallScore: 81 },
        { jobId: "crawl-up-prev", overallScore: 70 },
      ]);

    const service = createRecommendationsService(fakeDb);
    const feed = await service.getPortfolioPriorityFeed("u-1", { limit: 10 });

    expect(feed).toHaveLength(2);
    expect(feed[0].projectId).toBe("proj-drop");
    expect(feed[0].trendDelta).toBe(-16);
    expect(feed[1].projectId).toBe("proj-up");
    expect(feed[1].trendDelta).toBe(11);
  });
});
