import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildProject, buildUser, buildCrawlJob } from "../helpers/factories";

// ---------------------------------------------------------------------------
// Mock auth middleware so tests bypass JWT verification.
// The test-app already sets c.var.userId; this mock just calls next().
// ---------------------------------------------------------------------------

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
}));

// ---------------------------------------------------------------------------
// Mock the repository factory functions so routes never hit a real DB
// ---------------------------------------------------------------------------

const mockProjectRepo = {
  listByUser: vi.fn().mockResolvedValue([]),
  listPortfolioByUser: vi.fn().mockResolvedValue([]),
  countByUser: vi.fn().mockResolvedValue(0),
  countPortfolioByUser: vi.fn().mockResolvedValue(0),
  getById: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({ id: "proj-new" }),
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
  getLatestByProjects: vi.fn().mockResolvedValue([]),
  listByProject: vi.fn().mockResolvedValue([]),
  updateStatus: vi.fn().mockResolvedValue(undefined),
  generateShareToken: vi.fn().mockResolvedValue("token"),
  disableSharing: vi.fn().mockResolvedValue(undefined),
};

const mockScoreRepo = {
  listByJob: vi.fn().mockResolvedValue([]),
  listByJobs: vi.fn().mockResolvedValue([]),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Project Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRepo.getById.mockResolvedValue(buildUser({ id: "test-user-id" }));
    mockProjectRepo.listByUser.mockResolvedValue([]);
    mockProjectRepo.listPortfolioByUser.mockResolvedValue([]);
    mockProjectRepo.countByUser.mockResolvedValue(0);
    mockProjectRepo.countPortfolioByUser.mockResolvedValue(0);
    mockProjectRepo.getById.mockResolvedValue(null);
    mockProjectRepo.create.mockResolvedValue({ id: "proj-new" });
  });

  // -----------------------------------------------------------------------
  // GET /api/projects
  // -----------------------------------------------------------------------

  describe("GET /api/projects", () => {
    it("returns 200 with paginated project list", async () => {
      const project = buildProject({ userId: "test-user-id" });
      mockProjectRepo.listPortfolioByUser.mockResolvedValue([
        { ...project, latestCrawl: null },
      ]);
      mockProjectRepo.countPortfolioByUser.mockResolvedValue(1);

      const res = await request("/api/projects");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBe(1);
      expect(body.pagination).toHaveProperty("page");
      expect(body.pagination).toHaveProperty("total");
      expect(body.pagination).toHaveProperty("totalPages");
    });

    it("returns empty array when user has no projects", async () => {
      mockProjectRepo.listPortfolioByUser.mockResolvedValue([]);
      mockProjectRepo.countPortfolioByUser.mockResolvedValue(0);

      const res = await request("/api/projects");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/projects
  // -----------------------------------------------------------------------

  describe("POST /api/projects", () => {
    it("returns 201 when creating a project with valid data", async () => {
      mockProjectRepo.create.mockResolvedValue({
        id: "proj-new",
        name: "My Site",
        domain: "https://example.com",
      });

      const res = await request("/api/projects", {
        method: "POST",
        json: { name: "My Site", domain: "example.com" },
      });
      expect(res.status).toBe(201);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id");
    });

    it("returns 422 when domain is missing", async () => {
      const res = await request("/api/projects", {
        method: "POST",
        json: { name: "My Site" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 when name is missing", async () => {
      const res = await request("/api/projects", {
        method: "POST",
        json: { domain: "example.com" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/projects/:id
  // -----------------------------------------------------------------------

  describe("GET /api/projects/:id", () => {
    it("returns 200 with project detail when project exists", async () => {
      const project = buildProject({ id: "proj-1", userId: "test-user-id" });
      mockProjectRepo.getById.mockResolvedValue(project);
      mockCrawlRepo.getLatestByProject.mockResolvedValue(null);

      const res = await request("/api/projects/proj-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.id).toBe("proj-1");
      expect(body.data.latestCrawl).toBeNull();
    });

    it("returns 404 when project does not exist", async () => {
      mockProjectRepo.getById.mockResolvedValue(null);

      const res = await request("/api/projects/nonexistent");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/projects/:id
  // -----------------------------------------------------------------------

  describe("DELETE /api/projects/:id", () => {
    it("returns 200 with deletion confirmation", async () => {
      const project = buildProject({ id: "proj-1", userId: "test-user-id" });
      mockProjectRepo.getById.mockResolvedValue(project);

      const res = await request("/api/projects/proj-1", { method: "DELETE" });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toEqual({ id: "proj-1", deleted: true });
    });

    it("returns 404 when deleting non-existent project", async () => {
      mockProjectRepo.getById.mockResolvedValue(null);

      const res = await request("/api/projects/nonexistent", {
        method: "DELETE",
      });
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});
