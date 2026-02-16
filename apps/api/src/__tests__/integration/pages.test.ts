import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildCrawlJob, buildScore } from "../helpers/factories";
import { ServiceError } from "../../services/errors";

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
  createBatch: vi.fn().mockResolvedValue([]),
};

const mockScoreRepo = {
  listByJob: vi.fn().mockResolvedValue([]),
  getIssuesByJob: vi.fn().mockResolvedValue([]),
  listByJobWithPages: vi.fn().mockResolvedValue([]),
  getByPageWithIssues: vi.fn().mockResolvedValue({
    score: buildScore(),
    issues: [],
  }),
  createBatch: vi.fn().mockResolvedValue(undefined),
  createIssues: vi.fn().mockResolvedValue(undefined),
};

const mockEnrichmentRepo = {
  listByPage: vi.fn().mockResolvedValue([]),
};

vi.mock("../../repositories", () => ({
  createProjectRepository: () => mockProjectRepo,
  createUserRepository: () => ({}),
  createCrawlRepository: () => mockCrawlRepo,
  createScoreRepository: () => mockScoreRepo,
  createPageRepository: () => mockPageRepo,
  createEnrichmentRepository: () => mockEnrichmentRepo,
}));

// ---------------------------------------------------------------------------
// Mock the page service — we control return values per test
// ---------------------------------------------------------------------------

const mockGetPage = vi.fn();
const mockListPagesForJob = vi.fn();
const mockListIssues = vi.fn();
const mockListEnrichments = vi.fn();

vi.mock("../../services/page-service", () => ({
  createPageService: () => ({
    getPage: mockGetPage,
    listPagesForJob: mockListPagesForJob,
    listIssues: mockListIssues,
    listEnrichments: mockListEnrichments,
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Page Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // GET /api/pages/:id
  // -----------------------------------------------------------------------

  describe("GET /api/pages/:id", () => {
    it("returns 200 with page detail including scores and issues", async () => {
      mockGetPage.mockResolvedValue({
        id: "page-1",
        url: "https://example.com",
        title: "Home Page",
        wordCount: 500,
        score: buildScore({ overallScore: 85 }),
        issues: [
          {
            code: "MISSING_H1",
            category: "technical",
            severity: "warning",
            message: "Missing H1",
          },
        ],
      });

      const res = await request("/api/pages/page-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id", "page-1");
      expect(body.data).toHaveProperty("url", "https://example.com");
      expect(body.data).toHaveProperty("score");
      expect(body.data).toHaveProperty("issues");
    });

    it("returns 404 when page does not exist", async () => {
      mockGetPage.mockRejectedValue(
        new ServiceError("NOT_FOUND", 404, "Page not found"),
      );

      const res = await request("/api/pages/nonexistent");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 when page belongs to different user", async () => {
      mockGetPage.mockRejectedValue(
        new ServiceError("NOT_FOUND", 404, "Not found"),
      );

      const res = await request("/api/pages/page-other");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/pages/job/:jobId
  // -----------------------------------------------------------------------

  describe("GET /api/pages/job/:jobId", () => {
    it("returns 200 with paginated list of pages for a crawl job", async () => {
      mockListPagesForJob.mockResolvedValue([
        {
          id: "page-1",
          url: "https://example.com",
          overallScore: 85,
          technicalScore: 80,
          contentScore: 90,
          aiReadinessScore: 80,
          letterGrade: "B",
          issueCount: 3,
        },
        {
          id: "page-2",
          url: "https://example.com/about",
          overallScore: 70,
          technicalScore: 65,
          contentScore: 75,
          aiReadinessScore: 70,
          letterGrade: "C",
          issueCount: 5,
        },
      ]);

      const res = await request("/api/pages/job/crawl-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBe(2);
      expect(body.pagination).toHaveProperty("page", 1);
      expect(body.pagination).toHaveProperty("total", 2);
      expect(body.pagination).toHaveProperty("totalPages", 1);
    });

    it("returns 200 with empty array when no pages for job", async () => {
      mockListPagesForJob.mockResolvedValue([]);

      const res = await request("/api/pages/job/crawl-empty");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });

    it("returns 404 when crawl job does not exist", async () => {
      mockListPagesForJob.mockRejectedValue(
        new ServiceError("NOT_FOUND", 404, "Crawl not found"),
      );

      const res = await request("/api/pages/job/nonexistent");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 when crawl job belongs to different user", async () => {
      mockListPagesForJob.mockRejectedValue(
        new ServiceError("NOT_FOUND", 404, "Not found"),
      );

      const res = await request("/api/pages/job/crawl-other");
      expect(res.status).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/pages/issues/job/:jobId
  // -----------------------------------------------------------------------

  describe("GET /api/pages/issues/job/:jobId", () => {
    it("returns 200 with list of issues for a crawl job", async () => {
      mockListIssues.mockResolvedValue([
        {
          code: "MISSING_TITLE",
          category: "technical",
          severity: "critical",
          message: "Missing title tag",
          recommendation: "Add a descriptive title",
        },
        {
          code: "LOW_WORD_COUNT",
          category: "content",
          severity: "warning",
          message: "Low word count",
          recommendation: "Increase content length",
        },
      ]);

      const res = await request("/api/pages/issues/job/crawl-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBe(2);
      expect(body.pagination).toHaveProperty("total", 2);
    });

    it("returns 200 with empty array when no issues", async () => {
      mockListIssues.mockResolvedValue([]);

      const res = await request("/api/pages/issues/job/crawl-clean");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toEqual([]);
    });

    it("returns 404 when crawl job does not exist", async () => {
      mockListIssues.mockRejectedValue(
        new ServiceError("NOT_FOUND", 404, "Crawl not found"),
      );

      const res = await request("/api/pages/issues/job/nonexistent");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/pages/:id/enrichments
  // -----------------------------------------------------------------------

  describe("GET /api/pages/:id/enrichments", () => {
    it("returns 200 with enrichment data", async () => {
      mockListEnrichments.mockResolvedValue([
        { id: "enr-1", provider: "psi", data: { score: 90 } },
      ]);

      const res = await request("/api/pages/page-1/enrichments");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBe(1);
    });

    it("returns 200 with empty array when no enrichments", async () => {
      mockListEnrichments.mockResolvedValue([]);

      const res = await request("/api/pages/page-1/enrichments");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toEqual([]);
    });

    it("returns 404 when page does not exist", async () => {
      mockListEnrichments.mockRejectedValue(
        new ServiceError("NOT_FOUND", 404, "Page not found"),
      );

      const res = await request("/api/pages/nonexistent/enrichments");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});
