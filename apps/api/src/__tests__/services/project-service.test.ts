import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProjectService } from "../../services/project-service";
import {
  createMockProjectRepo,
  createMockUserRepo,
  createMockCrawlRepo,
  createMockScoreRepo,
} from "../helpers/mock-repositories";
import {
  buildProject,
  buildUser,
  buildCrawlJob,
  buildScore,
  type UserResult,
  type ProjectResult,
} from "../helpers/factories";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProjectService", () => {
  let projects: ReturnType<typeof createMockProjectRepo>;
  let users: ReturnType<typeof createMockUserRepo>;
  let crawls: ReturnType<typeof createMockCrawlRepo>;
  let scores: ReturnType<typeof createMockScoreRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    const project = buildProject();
    const user = buildUser({ plan: "starter", email: "user@test.com" });
    projects = createMockProjectRepo();
    projects.getById.mockResolvedValue(project);
    projects.listByUser.mockResolvedValue([project]);
    projects.countByUser.mockResolvedValue(1);
    projects.listPortfolioByUser.mockResolvedValue([
      { ...project, latestCrawl: null },
    ]);
    projects.countPortfolioByUser.mockResolvedValue(1);
    users = createMockUserRepo();
    users.getById.mockResolvedValue(user);
    crawls = createMockCrawlRepo();
    scores = createMockScoreRepo();
  });

  describe("createProject", () => {
    it("creates project when within plan limit", async () => {
      // Starter plan allows 5 projects, user has 1
      const service = createProjectService({ projects, users, crawls, scores });
      await service.createProject("user-1", {
        name: "New Site",
        domain: "https://new.com",
      });

      expect(projects.create).toHaveBeenCalledWith({
        userId: "user-1",
        name: "New Site",
        domain: "https://new.com",
      });
    });

    it("throws PLAN_LIMIT_REACHED when at project cap", async () => {
      // Free plan allows 1 project — user already has 1
      users.getById.mockResolvedValue(
        buildUser({ plan: "free", email: "user@test.com" }),
      );
      projects.countByUser.mockResolvedValue(1);
      const service = createProjectService({ projects, users, crawls, scores });

      await expect(
        service.createProject("user-1", {
          name: "Second Site",
          domain: "https://second.com",
        }),
      ).rejects.toThrow("allows a maximum of");
    });

    it("throws NOT_FOUND when user doesn't exist", async () => {
      users.getById.mockResolvedValueOnce(undefined as UserResult);
      const service = createProjectService({ projects, users, crawls, scores });

      await expect(
        service.createProject("user-1", {
          name: "Site",
          domain: "https://a.com",
        }),
      ).rejects.toThrow("User not found");
    });
  });

  describe("getProjectDetail", () => {
    it("returns project with latest crawl", async () => {
      crawls.getLatestByProject.mockResolvedValue({
        ...buildCrawlJob({ id: "crawl-1", status: "complete" }),
      });
      scores.listByJob.mockResolvedValue([
        buildScore({
          overallScore: 90,
          technicalScore: 95,
          contentScore: 88,
          aiReadinessScore: 87,
          detail: {},
        }),
      ]);
      const service = createProjectService({ projects, users, crawls, scores });

      const result = await service.getProjectDetail("user-1", "proj-1");
      expect(result.name).toBe("My Site");
      expect(result.latestCrawl).toBeTruthy();
    });

    it("throws NOT_FOUND for wrong user", async () => {
      const service = createProjectService({ projects, users, crawls, scores });

      await expect(
        service.getProjectDetail("other-user", "proj-1"),
      ).rejects.toThrow("Resource does not exist");
    });
  });

  describe("updateProject", () => {
    it("updates project owned by user", async () => {
      const service = createProjectService({ projects, users, crawls, scores });

      await service.updateProject("user-1", "proj-1", { name: "Updated Name" });

      expect(projects.update).toHaveBeenCalledWith("proj-1", {
        name: "Updated Name",
      });
    });

    it("throws NOT_FOUND when user doesn't own project", async () => {
      const service = createProjectService({ projects, users, crawls, scores });

      await expect(
        service.updateProject("other-user", "proj-1", { name: "Hacked" }),
      ).rejects.toThrow("Resource does not exist");
    });
  });

  describe("deleteProject", () => {
    it("deletes project owned by user", async () => {
      const service = createProjectService({ projects, users, crawls, scores });

      const result = await service.deleteProject("user-1", "proj-1");

      expect(result).toEqual({ id: "proj-1", deleted: true });
      expect(projects.delete).toHaveBeenCalledWith("proj-1");
    });

    it("throws NOT_FOUND when project doesn't exist", async () => {
      projects.getById.mockResolvedValueOnce(undefined as ProjectResult);
      const service = createProjectService({ projects, users, crawls, scores });

      await expect(
        service.deleteProject("user-1", "proj-unknown"),
      ).rejects.toThrow("Resource does not exist");
    });
  });

  describe("listForUser", () => {
    it("paginates results correctly", async () => {
      const pageProjects = Array.from({ length: 5 }, (_, i) => ({
        ...buildProject({ id: `proj-${i}` }),
        latestCrawl: null,
      }));
      projects.listPortfolioByUser.mockResolvedValue(pageProjects);
      projects.countPortfolioByUser.mockResolvedValue(12);
      const service = createProjectService({ projects, users, crawls, scores });

      const result = await service.listForUser("user-1", { page: 2, limit: 5 });

      expect(result.data).toHaveLength(5);
      expect(result.pagination.total).toBe(12);
      expect(result.pagination.totalPages).toBe(3);
      expect(projects.listPortfolioByUser).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          limit: 5,
          offset: 5,
        }),
      );
      expect(projects.countPortfolioByUser).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({}),
      );
    });
  });
});
