import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildUser, buildProject } from "../helpers/factories";

// ---------------------------------------------------------------------------
// Mock auth middleware to bypass JWT verification
// ---------------------------------------------------------------------------

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
}));

const reporterMocks = vi.hoisted(() => ({
  fetchReportData: vi.fn(),
  aggregateReportData: vi.fn(),
}));

vi.mock("@llm-boost/reports", () => ({
  fetchReportData: reporterMocks.fetchReportData,
  aggregateReportData: reporterMocks.aggregateReportData,
}));

// ---------------------------------------------------------------------------
// Stable mock functions for @llm-boost/db query helpers used directly
// by the dashboard route (not through the repository layer).
// ---------------------------------------------------------------------------

const mockUserGetById = vi
  .fn()
  .mockResolvedValue(
    buildUser({ id: "test-user-id", plan: "pro", crawlCreditsRemaining: 5 }),
  );
const mockProjectListByUser = vi
  .fn()
  .mockResolvedValue([buildProject({ id: "proj-1", userId: "test-user-id" })]);
const mockGetStatsForUser = vi.fn().mockResolvedValue({
  totalCrawls: 10,
  avgScore: 82,
});
const mockGetRecentForUser = vi.fn().mockResolvedValue([
  {
    id: "crawl-1",
    projectId: "proj-1",
    status: "complete",
    createdAt: new Date("2024-01-01"),
  },
]);

vi.mock("@llm-boost/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@llm-boost/db")>();
  return {
    ...orig,
    userQueries: () => ({
      getById: mockUserGetById,
    }),
    projectQueries: () => ({
      listByUser: mockProjectListByUser,
    }),
    crawlQueries: () => ({
      getStatsForUser: mockGetStatsForUser,
      getRecentForUser: mockGetRecentForUser,
    }),
    createDb: orig.createDb,
  };
});

// ---------------------------------------------------------------------------
// Mock repositories — provide all 5 factories required by createContainer()
// ---------------------------------------------------------------------------

vi.mock("../../repositories", () => ({
  createProjectRepository: () => ({}),
  createUserRepository: () => ({}),
  createCrawlRepository: () => ({}),
  createScoreRepository: () => ({}),
  createPageRepository: () => ({}),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Dashboard Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserGetById.mockResolvedValue(
      buildUser({ id: "test-user-id", plan: "pro", crawlCreditsRemaining: 5 }),
    );
    mockProjectListByUser.mockResolvedValue([
      buildProject({ id: "proj-1", userId: "test-user-id" }),
    ]);
    mockGetStatsForUser.mockResolvedValue({ totalCrawls: 10, avgScore: 82 });
    mockGetRecentForUser.mockResolvedValue([
      {
        id: "crawl-1",
        projectId: "proj-1",
        status: "complete",
        createdAt: new Date("2024-01-01"),
      },
    ]);
    reporterMocks.fetchReportData.mockResolvedValue({} as any);
    reporterMocks.aggregateReportData.mockReturnValue({
      quickWins: [],
      readinessCoverage: [],
      scoreDeltas: {
        overall: 0,
        technical: 0,
        content: 0,
        aiReadiness: 0,
        performance: 0,
      },
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/dashboard/stats
  // -----------------------------------------------------------------------

  describe("GET /api/dashboard/stats", () => {
    it("returns 200 with aggregated stats shape", async () => {
      const res = await request("/api/dashboard/stats");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("totalProjects");
      expect(body.data).toHaveProperty("totalCrawls");
      expect(body.data).toHaveProperty("avgScore");
      expect(body.data).toHaveProperty("creditsRemaining");
      expect(body.data).toHaveProperty("creditsTotal");
      expect(body.data).toHaveProperty("latestInsights");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/dashboard/activity
  // -----------------------------------------------------------------------

  describe("GET /api/dashboard/activity", () => {
    it("returns 200 with recent crawl activity", async () => {
      const res = await request("/api/dashboard/activity");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
    });
  });

  // -----------------------------------------------------------------------
  // Stats are cached in KV
  // -----------------------------------------------------------------------

  it("caches dashboard stats in KV on subsequent calls", async () => {
    // First call populates the cache
    const res1 = await request("/api/dashboard/stats");
    expect(res1.status).toBe(200);

    // Second call should still return 200 (from KV cache)
    const res2 = await request("/api/dashboard/stats");
    expect(res2.status).toBe(200);

    const body1: any = await res1.json();
    const body2: any = await res2.json();
    expect(body1.data).toEqual(body2.data);
  });
});
