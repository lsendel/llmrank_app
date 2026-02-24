import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetById = vi.fn();
const mockListByUser = vi.fn();
const mockGetLatestByProject = vi.fn();
const mockGetLatestByProjects = vi.fn();
const mockGetIssuesByJob = vi.fn();
const mockCountByProject = vi.fn();
const mockListByProject = vi.fn();
const mockGetLatestPipeline = vi.fn();

vi.mock("@llm-boost/db", () => ({
  projectQueries: () => ({
    getById: mockGetById,
    listByUser: mockListByUser,
  }),
  crawlQueries: () => ({
    getLatestByProject: mockGetLatestByProject,
    getLatestByProjects: mockGetLatestByProjects,
  }),
  scoreQueries: () => ({ getIssuesByJob: mockGetIssuesByJob }),
  savedKeywordQueries: () => ({ countByProject: mockCountByProject }),
  competitorQueries: () => ({ listByProject: mockListByProject }),
  pipelineRunQueries: () => ({ getLatestByProject: mockGetLatestPipeline }),
}));

import { createRecommendationsService } from "../../services/recommendations-service";

describe("createRecommendationsService", () => {
  const fakeDb = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
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
    mockCountByProject.mockResolvedValueOnce(8);
    mockListByProject.mockResolvedValueOnce([{ id: "comp-1" }]);

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
      source: { signals: ["issue_severity", "issue_count"] },
    });
    expect(feed[1].freshness.generatedAt).toBeTruthy();
  });
});
