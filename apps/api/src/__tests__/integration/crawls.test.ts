import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildProject, buildUser, buildCrawlJob } from "../helpers/factories";

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

const mockUserRepo = {
  getById: vi.fn().mockResolvedValue(buildUser({ id: "test-user-id" })),
  decrementCrawlCredits: vi.fn().mockResolvedValue(true),
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

const mockScoreRepo = {
  listByJob: vi.fn().mockResolvedValue([]),
  getIssuesByJob: vi.fn().mockResolvedValue([]),
  listByJobWithPages: vi.fn().mockResolvedValue([]),
  getByPageWithIssues: vi.fn().mockResolvedValue(null),
  createBatch: vi.fn().mockResolvedValue(undefined),
  createIssues: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../../repositories", () => ({
  createProjectRepository: () => mockProjectRepo,
  createUserRepository: () => mockUserRepo,
  createCrawlRepository: () => mockCrawlRepo,
  createScoreRepository: () => mockScoreRepo,
  createPageRepository: () => ({}),
}));

// Mock signPayload and fetch for crawler dispatch
vi.mock("../../middleware/hmac", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../../middleware/hmac")>();
  return {
    ...orig,
    signPayload: vi.fn().mockResolvedValue({
      signature: "hmac-sha256=abc123",
      timestamp: "1700000000",
    }),
  };
});

const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({}),
});
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Crawl Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRepo.getById.mockResolvedValue(buildUser({ id: "test-user-id" }));
    mockProjectRepo.getById.mockResolvedValue(
      buildProject({ id: "proj-1", userId: "test-user-id" }),
    );
    mockCrawlRepo.getLatestByProject.mockResolvedValue(null);
    mockCrawlRepo.create.mockResolvedValue(buildCrawlJob());
    mockUserRepo.decrementCrawlCredits.mockResolvedValue(true);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/crawls
  // -----------------------------------------------------------------------

  describe("POST /api/crawls", () => {
    it("returns 201 when creating a crawl with valid projectId", async () => {
      const res = await request("/api/crawls", {
        method: "POST",
        json: { projectId: "proj-1" },
      });
      expect(res.status).toBe(201);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id");
    });

    it("returns 422 when projectId is missing", async () => {
      const res = await request("/api/crawls", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBe("projectId is required");
    });

    it("returns error when user has no crawl credits", async () => {
      mockUserRepo.getById.mockResolvedValue(
        buildUser({ id: "test-user-id", crawlCreditsRemaining: 0 }),
      );
      mockUserRepo.decrementCrawlCredits.mockResolvedValue(false);

      const res = await request("/api/crawls", {
        method: "POST",
        json: { projectId: "proj-1" },
      });
      expect(res.status).toBe(429);

      const body: any = await res.json();
      expect(body.error.code).toBe("CRAWL_LIMIT_REACHED");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/crawls/:id
  // -----------------------------------------------------------------------

  describe("GET /api/crawls/:id", () => {
    it("returns 200 with crawl data and cache headers when complete", async () => {
      const crawl = buildCrawlJob({
        id: "crawl-1",
        projectId: "proj-1",
        status: "complete",
      });
      mockCrawlRepo.getById.mockResolvedValue(crawl);

      const res = await request("/api/crawls/crawl-1");
      expect(res.status).toBe(200);

      const cacheControl = res.headers.get("cache-control");
      expect(cacheControl).toContain("max-age=86400");

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id", "crawl-1");
    });

    it("returns private cache headers when crawl is in-progress", async () => {
      const crawl = buildCrawlJob({
        id: "crawl-1",
        projectId: "proj-1",
        status: "crawling",
      });
      mockCrawlRepo.getById.mockResolvedValue(crawl);

      const res = await request("/api/crawls/crawl-1");
      expect(res.status).toBe(200);

      const cacheControl = res.headers.get("cache-control");
      expect(cacheControl).toContain("private");
    });

    it("returns 404 for non-existent crawl", async () => {
      mockCrawlRepo.getById.mockResolvedValue(null);

      const res = await request("/api/crawls/nonexistent");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/crawls/project/:projectId
  // -----------------------------------------------------------------------

  describe("GET /api/crawls/project/:projectId", () => {
    it("returns 200 with crawl list and pagination metadata", async () => {
      const crawl = buildCrawlJob({ projectId: "proj-1" });
      mockCrawlRepo.listByProject.mockResolvedValue([crawl]);

      const res = await request("/api/crawls/project/proj-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.pagination).toHaveProperty("page", 1);
      expect(body.pagination).toHaveProperty("total", 1);
    });
  });
});
