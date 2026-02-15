import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildProject, buildCrawlJob, buildScore } from "../helpers/factories";

// ---------------------------------------------------------------------------
// Mock auth middleware to bypass JWT verification
// ---------------------------------------------------------------------------

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
}));

// ---------------------------------------------------------------------------
// Mock repositories
// ---------------------------------------------------------------------------

const mockProjectRepo = {
  listByUser: vi.fn().mockResolvedValue([]),
  getById: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({ id: "proj-1" }),
  update: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  getDueForCrawl: vi.fn().mockResolvedValue([]),
  updateNextCrawl: vi.fn().mockResolvedValue(undefined),
};

const mockCrawlRepo = {
  create: vi.fn().mockResolvedValue(buildCrawlJob()),
  getById: vi.fn().mockResolvedValue(null),
  getLatestByProject: vi.fn().mockResolvedValue(null),
  listByProject: vi.fn().mockResolvedValue([]),
  updateStatus: vi.fn().mockResolvedValue(undefined),
  generateShareToken: vi.fn().mockResolvedValue("token"),
  disableSharing: vi.fn().mockResolvedValue(undefined),
};

const mockPageRepo = {
  listByJob: vi.fn().mockResolvedValue([]),
  getById: vi.fn().mockResolvedValue(null),
  createBatch: vi.fn().mockResolvedValue(undefined),
};

const mockScoreRepo = {
  listByJob: vi.fn().mockResolvedValue([]),
  getIssuesByJob: vi.fn().mockResolvedValue([]),
  listByJobWithPages: vi.fn().mockResolvedValue([]),
  getByPageWithIssues: vi.fn().mockResolvedValue({ score: null, issues: [] }),
  createBatch: vi.fn().mockResolvedValue(undefined),
  createIssues: vi.fn().mockResolvedValue(undefined),
};

const mockEnrichmentRepo = {
  listByPage: vi.fn().mockResolvedValue([]),
};

vi.mock("../../repositories", () => ({
  createProjectRepository: () => mockProjectRepo,
  createCrawlRepository: () => mockCrawlRepo,
  createPageRepository: () => mockPageRepo,
  createScoreRepository: () => mockScoreRepo,
  createEnrichmentRepository: () => mockEnrichmentRepo,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Score Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectRepo.getById.mockResolvedValue(
      buildProject({ id: "proj-1", userId: "test-user-id" }),
    );
  });

  // -----------------------------------------------------------------------
  // GET /api/scores/job/:jobId/pages
  // -----------------------------------------------------------------------

  describe("GET /api/scores/job/:jobId/pages", () => {
    it("returns 200 with page scores and immutable cache header", async () => {
      const crawl = buildCrawlJob({ id: "crawl-1", projectId: "proj-1" });
      mockCrawlRepo.getById.mockResolvedValue(crawl);
      mockScoreRepo.listByJobWithPages.mockResolvedValue([
        {
          ...buildScore(),
          page: { id: "page-1", url: "https://example.com" },
          detail: { performanceScore: 70 },
          issueCount: 2,
        },
      ]);

      const res = await request("/api/scores/job/crawl-1/pages");
      expect(res.status).toBe(200);

      const cacheControl = res.headers.get("cache-control");
      expect(cacheControl).toContain("immutable");

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
    });

    it("returns 404 when crawl does not exist", async () => {
      mockCrawlRepo.getById.mockResolvedValue(null);

      const res = await request("/api/scores/job/nonexistent/pages");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/scores/page/:pageId
  // -----------------------------------------------------------------------

  describe("GET /api/scores/page/:pageId", () => {
    it("returns 200 with page detail, score, and issues", async () => {
      mockPageRepo.getById.mockResolvedValue({
        id: "page-1",
        projectId: "proj-1",
        url: "https://example.com",
        title: "Example",
      });
      mockScoreRepo.getByPageWithIssues.mockResolvedValue({
        score: buildScore({ pageId: "page-1" }),
        issues: [],
      });

      const res = await request("/api/scores/page/page-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id", "page-1");
      expect(body.data).toHaveProperty("score");
      expect(body.data).toHaveProperty("issues");
    });

    it("returns 404 when page does not exist", async () => {
      mockPageRepo.getById.mockResolvedValue(null);

      const res = await request("/api/scores/page/nonexistent");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});
