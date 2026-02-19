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

vi.mock("@llm-boost/db", async () => {
  const actual = await vi.importActual("@llm-boost/db");
  return {
    ...(actual as Record<string, unknown>),
    savedKeywordQueries: () => mockSavedKeywordQueries,
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
});
