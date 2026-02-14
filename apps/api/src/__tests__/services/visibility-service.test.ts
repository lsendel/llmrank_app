import { describe, it, expect, vi, beforeEach } from "vitest";
import { createVisibilityService } from "../../services/visibility-service";
import {
  createMockProjectRepo,
  createMockUserRepo,
  createMockVisibilityRepo,
  createMockCompetitorRepo,
} from "../helpers/mock-repositories";
import {
  buildProject,
  buildUser,
  buildVisibilityCheck,
  buildVisibilityTrend,
} from "../helpers/factories";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const projectFixture = buildProject({ domain: "example.com" });
const userFixture = buildUser({ plan: "pro" });

const mockChecker = {
  checkAllProviders: vi.fn().mockResolvedValue([
    {
      provider: "chatgpt",
      query: "test query",
      responseText: "Example.com is a great site...",
      brandMentioned: true,
      urlCited: true,
      citationPosition: 1,
      competitorMentions: {},
    },
  ]),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VisibilityService", () => {
  let projects: ReturnType<typeof createMockProjectRepo>;
  let users: ReturnType<typeof createMockUserRepo>;
  let visibility: ReturnType<typeof createMockVisibilityRepo>;
  let competitors: ReturnType<typeof createMockCompetitorRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    projects = createMockProjectRepo();
    projects.getById.mockResolvedValue(projectFixture);
    users = createMockUserRepo();
    users.getById.mockResolvedValue(userFixture);
    visibility = createMockVisibilityRepo();
    visibility.countSince.mockResolvedValue(5);
    visibility.create.mockImplementation((data) =>
      Promise.resolve(
        buildVisibilityCheck({
          ...data,
          id: "vis-1",
          projectId: data.projectId,
          llmProvider: data.llmProvider,
          query: data.query,
        }),
      ),
    );
    competitors = createMockCompetitorRepo({
      listByProject: vi
        .fn()
        .mockResolvedValue([{ id: "comp-1", domain: "rival.com" }]),
    });
  });

  describe("runCheck", () => {
    it("runs visibility check and stores results", async () => {
      const service = createVisibilityService({
        projects,
        users,
        visibility,
        checker: mockChecker as any,
        competitors,
      });

      const results = await service.runCheck({
        userId: "user-1",
        projectId: "proj-1",
        query: "test query",
        providers: ["chatgpt"],
        apiKeys: { openai: "sk-test" },
      });

      expect(mockChecker.checkAllProviders).toHaveBeenCalledWith({
        query: "test query",
        targetDomain: "example.com",
        competitors: ["rival.com"],
        providers: ["chatgpt"],
        apiKeys: { openai: "sk-test" },
      });
      expect(visibility.create).toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });

    it("throws NOT_FOUND when project not owned by user", async () => {
      projects.getById.mockResolvedValue(
        buildProject({ userId: "other-user" }),
      );
      const service = createVisibilityService({
        projects,
        users,
        visibility,
        checker: mockChecker as any,
      });

      await expect(
        service.runCheck({
          userId: "user-1",
          projectId: "proj-1",
          query: "test",
          providers: ["chatgpt"],
          apiKeys: {},
        }),
      ).rejects.toThrow("Project not found");
    });

    it("throws when monthly visibility limit reached", async () => {
      visibility.countSince.mockResolvedValue(100); // Pro plan limit is 100
      const service = createVisibilityService({
        projects,
        users,
        visibility,
        checker: mockChecker as any,
      });

      await expect(
        service.runCheck({
          userId: "user-1",
          projectId: "proj-1",
          query: "test",
          providers: ["chatgpt"],
          apiKeys: {},
        }),
      ).rejects.toThrow("Visibility check limit reached");
    });

    it("uses inline competitors when no competitor repo", async () => {
      const service = createVisibilityService({
        projects,
        users,
        visibility,
        checker: mockChecker as any,
        // no competitors repo
      });

      await service.runCheck({
        userId: "user-1",
        projectId: "proj-1",
        query: "test",
        providers: ["chatgpt"],
        competitors: ["inline-rival.com"],
        apiKeys: {},
      });

      expect(mockChecker.checkAllProviders).toHaveBeenCalledWith(
        expect.objectContaining({
          competitors: ["inline-rival.com"],
        }),
      );
    });
  });

  describe("listForProject", () => {
    it("returns checks for project owned by user", async () => {
      visibility.listByProject.mockResolvedValue([
        buildVisibilityCheck({ query: "test" }),
      ]);
      const service = createVisibilityService({
        projects,
        users,
        visibility,
      });

      const result = await service.listForProject("user-1", "proj-1");
      expect(result).toHaveLength(1);
    });

    it("throws NOT_FOUND for unauthorized user", async () => {
      const service = createVisibilityService({
        projects,
        users,
        visibility,
      });

      await expect(
        service.listForProject("other-user", "proj-1"),
      ).rejects.toThrow("Project not found");
    });
  });

  describe("getTrends", () => {
    it("returns trends for owned project", async () => {
      visibility.getTrends.mockResolvedValue([
        buildVisibilityTrend({ weekStart: "2026-01-04", totalChecks: 3 }),
      ]);
      const service = createVisibilityService({
        projects,
        users,
        visibility,
      });

      const result = await service.getTrends("user-1", "proj-1");
      expect(result).toHaveLength(1);
    });
  });
});
