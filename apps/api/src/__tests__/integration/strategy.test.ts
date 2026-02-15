import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildUser } from "../helpers/factories";
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
// Mock @llm-boost/db userQueries — used by enforcePlan middleware
// ---------------------------------------------------------------------------

const mockUserGetById = vi.fn().mockResolvedValue(null);

vi.mock("@llm-boost/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@llm-boost/db")>();
  return {
    ...orig,
    userQueries: () => ({
      getById: mockUserGetById,
      getByClerkId: vi.fn().mockResolvedValue(null),
      upsertFromClerk: vi.fn().mockResolvedValue(buildUser()),
    }),
    createDb: orig.createDb,
  };
});

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

const mockCompetitorRepo = {
  getById: vi.fn().mockResolvedValue(null),
  listByProject: vi.fn().mockResolvedValue([]),
  add: vi.fn().mockResolvedValue({ id: "comp-1", domain: "competitor.com" }),
  remove: vi.fn().mockResolvedValue(undefined),
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
  getByPageWithIssues: vi.fn().mockResolvedValue(null),
  createBatch: vi.fn().mockResolvedValue(undefined),
  createIssues: vi.fn().mockResolvedValue(undefined),
};

const mockCrawlRepo = {
  create: vi.fn().mockResolvedValue({ id: "crawl-1" }),
  getById: vi.fn().mockResolvedValue(null),
  getLatestByProject: vi.fn().mockResolvedValue(null),
  listByProject: vi.fn().mockResolvedValue([]),
  updateStatus: vi.fn().mockResolvedValue(undefined),
  generateShareToken: vi.fn().mockResolvedValue("token"),
  disableSharing: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../../repositories", () => ({
  createProjectRepository: () => mockProjectRepo,
  createCompetitorRepository: () => mockCompetitorRepo,
  createPageRepository: () => mockPageRepo,
  createScoreRepository: () => mockScoreRepo,
  createCrawlRepository: () => mockCrawlRepo,
  createUserRepository: () => ({ getById: mockUserGetById }),
}));

// ---------------------------------------------------------------------------
// Mock the strategy service — controls return values per test
// ---------------------------------------------------------------------------

const mockGetTopicMap = vi.fn();
const mockOptimize = vi.fn();
const mockBrief = vi.fn();
const mockGapAnalysis = vi.fn();
const mockPersonas = vi.fn();
const mockListCompetitors = vi.fn();
const mockAddCompetitor = vi.fn();
const mockRemoveCompetitor = vi.fn();

vi.mock("../../services/strategy-service", () => ({
  createStrategyService: () => ({
    getTopicMap: mockGetTopicMap,
    optimize: mockOptimize,
    brief: mockBrief,
    gapAnalysis: mockGapAnalysis,
    personas: mockPersonas,
    listCompetitors: mockListCompetitors,
    addCompetitor: mockAddCompetitor,
    removeCompetitor: mockRemoveCompetitor,
  }),
}));

// ---------------------------------------------------------------------------
// Mock LLM modules used directly by strategy routes
// ---------------------------------------------------------------------------

vi.mock("@llm-boost/llm", () => ({
  StrategyOptimizer: vi.fn().mockImplementation(() => ({
    generateContentFix: vi
      .fn()
      .mockResolvedValue({ suggestion: "Add pricing" }),
    rewriteForAIVisibility: vi.fn().mockResolvedValue({ rewritten: "..." }),
    generateContentBrief: vi.fn().mockResolvedValue({ brief: "..." }),
    analyzeStructuralGap: vi.fn().mockResolvedValue({ gaps: [] }),
  })),
  FactExtractor: vi.fn().mockImplementation(() => ({
    extractFacts: vi.fn().mockResolvedValue(["fact-1", "fact-2"]),
  })),
  PersonaGenerator: vi.fn().mockImplementation(() => ({
    generatePersonas: vi.fn().mockResolvedValue([{ name: "Developer Dan" }]),
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Strategy Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user is a "pro" user
    mockUserGetById.mockResolvedValue(
      buildUser({ id: "test-user-id", plan: "pro" }),
    );
  });

  // -----------------------------------------------------------------------
  // enforcePlan middleware
  // -----------------------------------------------------------------------

  describe("enforcePlan middleware", () => {
    it("returns 404 when user is not found", async () => {
      mockUserGetById.mockResolvedValue(null);

      const res = await request("/api/strategy/proj-1/topic-map");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toContain("User not found");
    });

    it("returns 403 when user plan does not meet required tier", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "free" }),
      );

      const res = await request("/api/strategy/proj-1/topic-map");
      expect(res.status).toBe(403);

      const body: any = await res.json();
      expect(body.error.code).toBe("PLAN_LIMIT_REACHED");
      expect(body.error.message).toContain("pro plan");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/strategy/:projectId/topic-map (Pro+)
  // -----------------------------------------------------------------------

  describe("GET /api/strategy/:projectId/topic-map", () => {
    it("returns 200 with topic map data", async () => {
      mockGetTopicMap.mockResolvedValue({
        nodes: [{ id: "https://example.com", label: "Home", score: 85 }],
        edges: [],
        clusters: [{ label: "General", keywords: ["home"], pageCount: 1 }],
      });

      const res = await request("/api/strategy/proj-1/topic-map");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("nodes");
      expect(body.data).toHaveProperty("edges");
    });

    it("returns 404 when service throws NOT_FOUND", async () => {
      mockGetTopicMap.mockRejectedValue(
        new ServiceError("NOT_FOUND", 404, "Not found"),
      );

      const res = await request("/api/strategy/proj-1/topic-map");
      expect(res.status).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/strategy/apply-fix (Starter+)
  // -----------------------------------------------------------------------

  describe("POST /api/strategy/apply-fix", () => {
    it("returns 200 with fix suggestion", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "starter" }),
      );
      mockPageRepo.getById.mockResolvedValue({
        id: "page-1",
        url: "https://example.com",
        title: "Home",
        wordCount: 500,
        projectId: "proj-1",
      });

      const res = await request("/api/strategy/apply-fix", {
        method: "POST",
        json: {
          pageId: "page-1",
          missingFact: "pricing information",
          factType: "pricing",
        },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("suggestion");
    });

    it("returns 404 when page not found", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "starter" }),
      );
      mockPageRepo.getById.mockResolvedValue(null);

      const res = await request("/api/strategy/apply-fix", {
        method: "POST",
        json: {
          pageId: "nonexistent",
          missingFact: "pricing",
          factType: "pricing",
        },
      });
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 403 when free user tries to access", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "free" }),
      );

      const res = await request("/api/strategy/apply-fix", {
        method: "POST",
        json: { pageId: "page-1", missingFact: "x", factType: "y" },
      });
      expect(res.status).toBe(403);

      const body: any = await res.json();
      expect(body.error.code).toBe("PLAN_LIMIT_REACHED");
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/strategy/optimize (Starter+)
  // -----------------------------------------------------------------------

  describe("POST /api/strategy/optimize", () => {
    it("returns 200 with optimized content", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "starter" }),
      );
      mockOptimize.mockResolvedValue({ rewritten: "optimized content" });

      const res = await request("/api/strategy/optimize", {
        method: "POST",
        json: { pageId: "page-1", content: "some content to optimize" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("rewritten");
    });

    it("returns 422 when pageId is missing", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "starter" }),
      );

      const res = await request("/api/strategy/optimize", {
        method: "POST",
        json: { content: "some content" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 when content is missing", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "starter" }),
      );

      const res = await request("/api/strategy/optimize", {
        method: "POST",
        json: { pageId: "page-1" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 403 for free plan user", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "free" }),
      );

      const res = await request("/api/strategy/optimize", {
        method: "POST",
        json: { pageId: "page-1", content: "test" },
      });
      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/strategy/brief (Starter+)
  // -----------------------------------------------------------------------

  describe("POST /api/strategy/brief", () => {
    it("returns 200 with content brief", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "starter" }),
      );
      mockBrief.mockResolvedValue({ brief: "keyword strategy document" });

      const res = await request("/api/strategy/brief", {
        method: "POST",
        json: { keyword: "ai seo tools" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("brief");
    });

    it("returns 422 when keyword is missing", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "starter" }),
      );

      const res = await request("/api/strategy/brief", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("keyword");
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/strategy/semantic-gap (Pro+)
  // -----------------------------------------------------------------------

  describe("POST /api/strategy/semantic-gap", () => {
    it("returns 200 with gap analysis data", async () => {
      mockPageRepo.getById.mockResolvedValue({
        id: "page-1",
        url: "https://example.com",
        title: "Home",
        wordCount: 500,
        projectId: "proj-1",
      });

      // Mock the global fetch for competitor content fetch
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html>competitor content</html>"),
      }) as any;

      const res = await request("/api/strategy/semantic-gap", {
        method: "POST",
        json: {
          projectId: "proj-1",
          pageId: "page-1",
          competitorDomain: "competitor.com",
        },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("userFacts");
      expect(body.data).toHaveProperty("competitorFacts");
      expect(body.data).toHaveProperty("densityGap");

      globalThis.fetch = originalFetch;
    });

    it("returns 404 when page not found", async () => {
      mockPageRepo.getById.mockResolvedValue(null);

      const res = await request("/api/strategy/semantic-gap", {
        method: "POST",
        json: {
          projectId: "proj-1",
          pageId: "nonexistent",
          competitorDomain: "competitor.com",
        },
      });
      expect(res.status).toBe(404);
    });

    it("returns 403 for starter plan user (requires Pro+)", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "starter" }),
      );

      const res = await request("/api/strategy/semantic-gap", {
        method: "POST",
        json: {
          projectId: "proj-1",
          pageId: "page-1",
          competitorDomain: "competitor.com",
        },
      });
      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/strategy/gap-analysis (Pro+)
  // -----------------------------------------------------------------------

  describe("POST /api/strategy/gap-analysis", () => {
    it("returns 200 with gap analysis result", async () => {
      mockGapAnalysis.mockResolvedValue({
        gaps: ["Missing pricing", "No FAQ"],
      });

      const res = await request("/api/strategy/gap-analysis", {
        method: "POST",
        json: {
          projectId: "proj-1",
          competitorDomain: "competitor.com",
          query: "best ai seo tool",
        },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("gaps");
    });

    it("returns 403 for free plan user", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "free" }),
      );

      const res = await request("/api/strategy/gap-analysis", {
        method: "POST",
        json: {
          projectId: "proj-1",
          competitorDomain: "competitor.com",
          query: "test",
        },
      });
      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/strategy/:projectId/personas (Starter+)
  // -----------------------------------------------------------------------

  describe("POST /api/strategy/:projectId/personas", () => {
    it("returns 200 with generated personas", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "starter" }),
      );
      mockPersonas.mockResolvedValue([
        { name: "Developer Dan", description: "Full-stack dev" },
      ]);

      const res = await request("/api/strategy/proj-1/personas", {
        method: "POST",
        json: { description: "SaaS tool for devs", niche: "DevTools" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data[0]).toHaveProperty("name");
    });

    it("returns 403 for free plan user", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "free" }),
      );

      const res = await request("/api/strategy/proj-1/personas", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/strategy/:projectId/competitors (Pro+)
  // -----------------------------------------------------------------------

  describe("GET /api/strategy/:projectId/competitors", () => {
    it("returns 200 with competitor list", async () => {
      mockListCompetitors.mockResolvedValue([
        { id: "comp-1", domain: "competitor.com" },
      ]);

      const res = await request("/api/strategy/proj-1/competitors");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data[0]).toHaveProperty("domain", "competitor.com");
    });

    it("returns 404 when service throws NOT_FOUND", async () => {
      mockListCompetitors.mockRejectedValue(
        new ServiceError("NOT_FOUND", 404, "Not found"),
      );

      const res = await request("/api/strategy/proj-1/competitors");
      expect(res.status).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/strategy/:projectId/competitors (Pro+)
  // -----------------------------------------------------------------------

  describe("POST /api/strategy/:projectId/competitors", () => {
    it("returns 201 when adding a competitor", async () => {
      mockAddCompetitor.mockResolvedValue({
        id: "comp-new",
        domain: "new-competitor.com",
      });

      const res = await request("/api/strategy/proj-1/competitors", {
        method: "POST",
        json: { domain: "new-competitor.com" },
      });
      expect(res.status).toBe(201);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("domain", "new-competitor.com");
    });

    it("returns 422 when domain is missing", async () => {
      const res = await request("/api/strategy/proj-1/competitors", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("domain");
    });

    it("returns 403 for starter plan user", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "starter" }),
      );

      const res = await request("/api/strategy/proj-1/competitors", {
        method: "POST",
        json: { domain: "competitor.com" },
      });
      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/strategy/competitors/:id (Pro+)
  // -----------------------------------------------------------------------

  describe("DELETE /api/strategy/competitors/:id", () => {
    it("returns 200 with deletion result", async () => {
      mockRemoveCompetitor.mockResolvedValue({ id: "comp-1", deleted: true });

      const res = await request("/api/strategy/competitors/comp-1", {
        method: "DELETE",
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("deleted", true);
    });

    it("returns 404 when competitor not found", async () => {
      mockRemoveCompetitor.mockRejectedValue(
        new ServiceError("NOT_FOUND", 404, "Competitor not found"),
      );

      const res = await request("/api/strategy/competitors/nonexistent", {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });
  });
});
