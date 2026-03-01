import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import {
  buildProject,
  buildUser,
  buildVisibilityCheck,
  buildVisibilityTrend,
} from "../helpers/factories";

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

const mockVisibilityRepo = {
  listByProject: vi.fn().mockResolvedValue([]),
  getTrends: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({ id: "vis-new" }),
  countSince: vi.fn().mockResolvedValue(0),
};

const mockCompetitorRepo = {
  getById: vi.fn().mockResolvedValue(null),
  listByProject: vi.fn().mockResolvedValue([]),
  add: vi.fn().mockResolvedValue({ id: "comp-1" }),
  remove: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../../repositories", () => ({
  createProjectRepository: () => mockProjectRepo,
  createUserRepository: () => mockUserRepo,
  createCrawlRepository: () => ({}),
  createScoreRepository: () => ({}),
  createPageRepository: () => ({}),
  createVisibilityRepository: () => mockVisibilityRepo,
  createCompetitorRepository: () => mockCompetitorRepo,
}));

// Mock @llm-boost/db for savedKeywordQueries used in POST /check
const mockSavedKeywordQueries = {
  listByProject: vi
    .fn()
    .mockResolvedValue([
      { id: "kw-1", keyword: "best SEO tools", projectId: "proj-1" },
    ]),
};

const mockDiscoveredLinkQueries = {
  getSummary: vi.fn().mockResolvedValue({
    referringDomains: 25,
    totalBacklinks: 125,
    dofollowLinks: 80,
    nofollowLinks: 45,
  }),
};

vi.mock("@llm-boost/db", async () => {
  const actual = await vi.importActual("@llm-boost/db");
  return {
    ...(actual as Record<string, unknown>),
    savedKeywordQueries: () => mockSavedKeywordQueries,
    discoveredLinkQueries: () => mockDiscoveredLinkQueries,
  };
});

// Mock the LLM visibility checker to avoid real API calls
vi.mock("@llm-boost/llm", () => ({
  VisibilityChecker: vi.fn().mockImplementation(() => ({
    checkAllProviders: vi.fn().mockResolvedValue([
      {
        provider: "chatgpt",
        query: "test query",
        responseText: "AI response mentioning example.com",
        brandMentioned: true,
        urlCited: false,
        citationPosition: null,
        competitorMentions: {},
      },
    ]),
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Visibility Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectRepo.getById.mockResolvedValue(
      buildProject({ id: "proj-1", userId: "test-user-id" }),
    );
    mockUserRepo.getById.mockResolvedValue(buildUser({ id: "test-user-id" }));
    mockVisibilityRepo.countSince.mockResolvedValue(0);
  });

  // -----------------------------------------------------------------------
  // GET /api/visibility/:projectId
  // -----------------------------------------------------------------------

  describe("GET /api/visibility/:projectId", () => {
    it("returns 200 with visibility results for a project", async () => {
      const check = buildVisibilityCheck({ projectId: "proj-1" });
      mockVisibilityRepo.listByProject.mockResolvedValue([check]);

      const res = await request("/api/visibility/proj-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBe(1);
    });

    it("returns 404 for non-owned project", async () => {
      mockProjectRepo.getById.mockResolvedValue(
        buildProject({ id: "proj-1", userId: "other-user" }),
      );

      const res = await request("/api/visibility/proj-1");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("forces free plan queries to US English locale filters", async () => {
      mockUserRepo.getById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "free" }),
      );

      const res = await request("/api/visibility/proj-1?region=gb&language=fr");
      expect(res.status).toBe(200);
      expect(mockVisibilityRepo.listByProject).toHaveBeenCalledWith("proj-1", {
        region: "us",
        language: "en",
      });
    });

    it("returns 422 when Pro requests unsupported region", async () => {
      mockUserRepo.getById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "pro" }),
      );

      const res = await request("/api/visibility/proj-1?region=mx");
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("allows agency locale filters for any valid 2-letter codes", async () => {
      mockUserRepo.getById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "agency" }),
      );

      const res = await request("/api/visibility/proj-1?region=mx&language=es");
      expect(res.status).toBe(200);
      expect(mockVisibilityRepo.listByProject).toHaveBeenCalledWith("proj-1", {
        region: "mx",
        language: "es",
      });
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/visibility/check
  // -----------------------------------------------------------------------

  describe("POST /api/visibility/check", () => {
    it("returns 201 with rate limit headers on valid check", async () => {
      mockVisibilityRepo.create.mockResolvedValue(
        buildVisibilityCheck({ projectId: "proj-1" }),
      );

      const res = await request("/api/visibility/check", {
        method: "POST",
        json: {
          projectId: "proj-1",
          keywordIds: ["kw-1"],
          providers: ["chatgpt"],
        },
      });
      expect(res.status).toBe(201);

      // Rate limit headers should be present
      expect(res.headers.get("x-ratelimit-limit")).toBeTruthy();
      expect(res.headers.get("x-ratelimit-remaining")).toBeTruthy();
    });

    it("returns 422 when required fields are missing", async () => {
      const res = await request("/api/visibility/check", {
        method: "POST",
        json: { projectId: "proj-1" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("forces free plan check locale to US English", async () => {
      mockUserRepo.getById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "free" }),
      );

      await request("/api/visibility/check", {
        method: "POST",
        json: {
          projectId: "proj-1",
          keywordIds: ["kw-1"],
          providers: ["chatgpt"],
          region: "gb",
          language: "fr",
        },
      });

      expect(mockVisibilityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          region: "us",
          language: "en",
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/visibility/:projectId/trends
  // -----------------------------------------------------------------------

  describe("GET /api/visibility/:projectId/trends", () => {
    it("returns 200 with trend data", async () => {
      const trend = buildVisibilityTrend();
      mockVisibilityRepo.getTrends.mockResolvedValue([trend]);

      const res = await request("/api/visibility/proj-1/trends");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data[0]).toHaveProperty("weekStart");
      expect(body.data[0]).toHaveProperty("mentionRate");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/visibility/:projectId/ai-score/trend
  // -----------------------------------------------------------------------

  describe("GET /api/visibility/:projectId/ai-score/trend", () => {
    it("returns audience estimate and growth based on current vs previous periods", async () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      mockVisibilityRepo.listByProject.mockResolvedValue([
        buildVisibilityCheck({
          projectId: "proj-1",
          query: "best llm rank tools",
          brandMentioned: true,
          competitorMentions: [],
          checkedAt: new Date(now - day),
        }),
        buildVisibilityCheck({
          projectId: "proj-1",
          id: "vis-2",
          query: "llm rank alternatives",
          brandMentioned: true,
          competitorMentions: [],
          checkedAt: new Date(now - 2 * day),
        }),
        buildVisibilityCheck({
          projectId: "proj-1",
          id: "vis-3",
          query: "ai seo platform reviews",
          brandMentioned: true,
          competitorMentions: [],
          checkedAt: new Date(now - 8 * day),
        }),
      ]);

      const res = await request("/api/visibility/proj-1/ai-score/trend");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.period).toBe("weekly");
      expect(body.data.meta.referringDomains).toBe(25);
      expect(body.data.meta.currentChecks).toBe(2);
      expect(body.data.meta.previousChecks).toBe(1);
      expect(body.data.meta.estimatedMonthlyAudience).toBe(200);
      expect(body.data.meta.audienceGrowth).toBe(100);
      expect(body.data.previous).toBeTruthy();
    });

    it("keeps audience growth at zero when there is no previous period data", async () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      mockVisibilityRepo.listByProject.mockResolvedValue([
        buildVisibilityCheck({
          projectId: "proj-1",
          query: "llm rank platform",
          brandMentioned: true,
          competitorMentions: [],
          checkedAt: new Date(now - day),
        }),
      ]);

      const res = await request("/api/visibility/proj-1/ai-score/trend");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.meta.currentChecks).toBe(1);
      expect(body.data.meta.previousChecks).toBe(0);
      expect(body.data.meta.estimatedMonthlyAudience).toBe(100);
      expect(body.data.meta.audienceGrowth).toBe(0);
      expect(body.data.previous).toBeNull();
    });
  });
});
