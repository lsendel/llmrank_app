import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";

// ---------------------------------------------------------------------------
// Mock auth middleware
// ---------------------------------------------------------------------------

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
}));

// ---------------------------------------------------------------------------
// Mock @llm-boost/db
// ---------------------------------------------------------------------------

const mockProjectGetById = vi.fn();
const mockUserGetById = vi.fn();
const mockCrawlGetLatestByProject = vi.fn();
const mockCompetitorListByProject = vi.fn();
const mockCompetitorAdd = vi.fn();
const mockCompBenchCreate = vi.fn();
const mockCompBenchListByProject = vi.fn();
const mockCompBenchGetLatest = vi.fn();

vi.mock("@llm-boost/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@llm-boost/db")>();
  return {
    ...orig,
    projectQueries: () => ({
      getById: mockProjectGetById,
    }),
    userQueries: () => ({
      getById: mockUserGetById,
    }),
    crawlQueries: () => ({
      getLatestByProject: mockCrawlGetLatestByProject,
    }),
    competitorQueries: () => ({
      listByProject: mockCompetitorListByProject,
      add: mockCompetitorAdd,
    }),
    competitorBenchmarkQueries: () => ({
      create: mockCompBenchCreate,
      listByProject: mockCompBenchListByProject,
      getLatest: mockCompBenchGetLatest,
    }),
    createDb: orig.createDb,
  };
});

// ---------------------------------------------------------------------------
// Mock the competitor-benchmark-service to avoid actual HTTP fetches
// ---------------------------------------------------------------------------

const mockBenchmarkCompetitor = vi.fn();
const mockGetComparison = vi.fn();

vi.mock("../../services/competitor-benchmark-service", () => ({
  createCompetitorBenchmarkService: vi.fn().mockReturnValue({
    benchmarkCompetitor: (...args: any[]) => mockBenchmarkCompetitor(...args),
    getComparison: (...args: any[]) => mockGetComparison(...args),
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Competitors Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUserGetById.mockResolvedValue({
      id: "test-user-id",
      plan: "pro",
    });

    mockProjectGetById.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000001",
      userId: "test-user-id",
      name: "Test Project",
      domain: "example.com",
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/competitors/benchmark
  // -----------------------------------------------------------------------

  describe("POST /api/competitors/benchmark", () => {
    it("returns 422 when projectId is missing", async () => {
      const res = await request("/api/competitors/benchmark", {
        method: "POST",
        json: { competitorDomain: "competitor.com" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 when competitorDomain is missing", async () => {
      const res = await request("/api/competitors/benchmark", {
        method: "POST",
        json: { projectId: "00000000-0000-0000-0000-000000000001" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 with invalid domain", async () => {
      const res = await request("/api/competitors/benchmark", {
        method: "POST",
        json: {
          projectId: "00000000-0000-0000-0000-000000000001",
          competitorDomain: "not a valid domain!!!",
        },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("INVALID_DOMAIN");
    });

    it("returns 422 when projectId is not a UUID", async () => {
      const res = await request("/api/competitors/benchmark", {
        method: "POST",
        json: {
          projectId: "not-a-uuid",
          competitorDomain: "competitor.com",
        },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 404 when project not found", async () => {
      mockProjectGetById.mockResolvedValue(null);

      const res = await request("/api/competitors/benchmark", {
        method: "POST",
        json: {
          projectId: "00000000-0000-0000-0000-000000000001",
          competitorDomain: "competitor.com",
        },
      });
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 when project belongs to different user", async () => {
      mockProjectGetById.mockResolvedValue({
        id: "00000000-0000-0000-0000-000000000001",
        userId: "different-user-id",
        name: "Other Project",
        domain: "other.com",
      });

      const res = await request("/api/competitors/benchmark", {
        method: "POST",
        json: {
          projectId: "00000000-0000-0000-0000-000000000001",
          competitorDomain: "competitor.com",
        },
      });
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 403 for free plan users", async () => {
      mockUserGetById.mockResolvedValue({ id: "test-user-id", plan: "free" });

      const res = await request("/api/competitors/benchmark", {
        method: "POST",
        json: {
          projectId: "00000000-0000-0000-0000-000000000001",
          competitorDomain: "competitor.com",
        },
      });
      expect(res.status).toBe(403);

      const body: any = await res.json();
      expect(body.error.code).toBe("PLAN_LIMIT_REACHED");
    });

    it("returns 201 on successful benchmark", async () => {
      mockBenchmarkCompetitor.mockResolvedValue({
        id: "bench-1",
        competitorDomain: "competitor.com",
        overallScore: 72,
      });

      const res = await request("/api/competitors/benchmark", {
        method: "POST",
        json: {
          projectId: "00000000-0000-0000-0000-000000000001",
          competitorDomain: "competitor.com",
        },
      });
      expect(res.status).toBe(201);

      const body: any = await res.json();
      expect(body.data.id).toBe("bench-1");
      expect(body.data.competitorDomain).toBe("competitor.com");
    });

    it("normalizes domain from full URL", async () => {
      mockBenchmarkCompetitor.mockResolvedValue({
        id: "bench-1",
        competitorDomain: "competitor.com",
        overallScore: 72,
      });

      const res = await request("/api/competitors/benchmark", {
        method: "POST",
        json: {
          projectId: "00000000-0000-0000-0000-000000000001",
          competitorDomain: "https://competitor.com/some/path",
        },
      });
      expect(res.status).toBe(201);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/competitors
  // -----------------------------------------------------------------------

  describe("GET /api/competitors", () => {
    it("returns 422 when projectId query param is missing", async () => {
      const res = await request("/api/competitors");
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 404 when project not found", async () => {
      mockProjectGetById.mockResolvedValue(null);

      const res = await request(
        "/api/competitors?projectId=00000000-0000-0000-0000-000000000001",
      );
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 when project belongs to different user", async () => {
      mockProjectGetById.mockResolvedValue({
        id: "00000000-0000-0000-0000-000000000001",
        userId: "different-user-id",
        name: "Other Project",
        domain: "other.com",
      });

      const res = await request(
        "/api/competitors?projectId=00000000-0000-0000-0000-000000000001",
      );
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 200 with comparison data when crawl data exists", async () => {
      mockCrawlGetLatestByProject.mockResolvedValue({
        id: "crawl-1",
        summaryData: {
          overallScore: 85,
          technicalScore: 90,
          contentScore: 80,
          aiReadinessScore: 82,
          performanceScore: 88,
          letterGrade: "B",
        },
      });

      mockGetComparison.mockResolvedValue([
        {
          competitorDomain: "competitor.com",
          scores: {
            overall: 72,
            technical: 80,
            content: 65,
            aiReadiness: 70,
            performance: 75,
            letterGrade: "C",
          },
          comparison: {
            overall: 13,
            technical: 10,
            content: 15,
            aiReadiness: 12,
            performance: 13,
          },
          crawledAt: new Date().toISOString(),
        },
      ]);

      const res = await request(
        "/api/competitors?projectId=00000000-0000-0000-0000-000000000001",
      );
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.projectScores).toBeDefined();
      expect(body.data.projectScores.overall).toBe(85);
      expect(body.data.competitors).toHaveLength(1);
      expect(body.data.competitors[0].competitorDomain).toBe("competitor.com");
    });

    it("returns 200 with zero scores when no crawl data exists", async () => {
      mockCrawlGetLatestByProject.mockResolvedValue(null);
      mockGetComparison.mockResolvedValue([]);

      const res = await request(
        "/api/competitors?projectId=00000000-0000-0000-0000-000000000001",
      );
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.projectScores).toBeDefined();
      expect(body.data.projectScores.overall).toBe(0);
      expect(body.data.projectScores.letterGrade).toBe("F");
      expect(body.data.competitors).toHaveLength(0);
    });
  });
});
