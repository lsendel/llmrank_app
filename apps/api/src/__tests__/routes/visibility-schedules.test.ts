import { describe, it, expect, vi, beforeEach } from "vitest";
import { createScheduledVisibilityService } from "../../services/scheduled-visibility-service";
import { buildUser, buildProject } from "../helpers/factories";

/**
 * These tests exercise the service layer that the route delegates to,
 * verifying CRUD behavior for scheduled visibility queries.
 * The routes are thin — they validate input and forward to the service.
 */
describe("Visibility Schedules — Route-level service integration", () => {
  const mockScheduleRepo = {
    create: vi.fn(),
    listByProject: vi.fn().mockResolvedValue([]),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    countByProject: vi.fn().mockResolvedValue(0),
  };
  const mockProjectRepo = {
    getById: vi.fn(),
  };
  const mockUserRepo = {
    getById: vi.fn(),
  };

  function buildService() {
    return createScheduledVisibilityService({
      schedules: mockScheduleRepo,
      projects: mockProjectRepo,
      users: mockUserRepo,
    });
  }

  beforeEach(() => vi.clearAllMocks());

  // -----------------------------------------------------------------
  // POST / — Create
  // -----------------------------------------------------------------
  describe("POST / — create scheduled query", () => {
    it("creates a schedule and returns data", async () => {
      const user = buildUser({ plan: "pro" });
      const project = buildProject({ userId: user.id });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(project);
      mockScheduleRepo.countByProject.mockResolvedValue(0);

      const schedule = {
        id: "sq-1",
        projectId: project.id,
        query: "best CRM software",
        providers: ["chatgpt", "claude"],
        frequency: "daily",
      };
      mockScheduleRepo.create.mockResolvedValue(schedule);

      const service = buildService();
      const result = await service.create({
        userId: user.id,
        projectId: project.id,
        query: "best CRM software",
        providers: ["chatgpt", "claude"],
        frequency: "daily",
      });

      expect(result).toEqual(schedule);
      expect(mockScheduleRepo.create).toHaveBeenCalledWith({
        projectId: project.id,
        query: "best CRM software",
        providers: ["chatgpt", "claude"],
        frequency: "daily",
      });
    });

    it("rejects when user not found", async () => {
      mockUserRepo.getById.mockResolvedValue(null);

      const service = buildService();
      await expect(
        service.create({
          userId: "no-user",
          projectId: "proj-1",
          query: "test",
          providers: ["chatgpt"],
          frequency: "daily",
        }),
      ).rejects.toThrow("User not found");
    });

    it("rejects when project not found", async () => {
      const user = buildUser({ plan: "pro" });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(null);

      const service = buildService();
      await expect(
        service.create({
          userId: user.id,
          projectId: "missing",
          query: "test",
          providers: ["chatgpt"],
          frequency: "daily",
        }),
      ).rejects.toThrow("Project not found");
    });

    it("rejects when project belongs to another user", async () => {
      const user = buildUser({ plan: "pro" });
      const project = buildProject({ userId: "other-user" });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(project);

      const service = buildService();
      await expect(
        service.create({
          userId: user.id,
          projectId: project.id,
          query: "test",
          providers: ["chatgpt"],
          frequency: "daily",
        }),
      ).rejects.toThrow("Project not found");
    });

    it("rejects for free plan (scheduledQueries === 0)", async () => {
      const user = buildUser({ plan: "free" });
      const project = buildProject({ userId: user.id });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(project);

      const service = buildService();
      await expect(
        service.create({
          userId: user.id,
          projectId: project.id,
          query: "test",
          providers: ["chatgpt"],
          frequency: "daily",
        }),
      ).rejects.toThrow("PLAN_LIMIT_REACHED");
    });

    it("rejects hourly frequency for starter plan", async () => {
      const user = buildUser({ plan: "starter" });
      const project = buildProject({ userId: user.id });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(project);

      const service = buildService();
      await expect(
        service.create({
          userId: user.id,
          projectId: project.id,
          query: "test",
          providers: ["chatgpt"],
          frequency: "hourly",
        }),
      ).rejects.toThrow("PLAN_LIMIT_REACHED");
    });

    it("rejects when schedule count exceeds plan limit", async () => {
      const user = buildUser({ plan: "starter" });
      const project = buildProject({ userId: user.id });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(project);
      mockScheduleRepo.countByProject.mockResolvedValue(5);

      const service = buildService();
      await expect(
        service.create({
          userId: user.id,
          projectId: project.id,
          query: "test",
          providers: ["chatgpt"],
          frequency: "daily",
        }),
      ).rejects.toThrow("PLAN_LIMIT_REACHED");
    });
  });

  // -----------------------------------------------------------------
  // GET / — List
  // -----------------------------------------------------------------
  describe("GET / — list scheduled queries", () => {
    it("returns schedules for a project owned by user", async () => {
      const user = buildUser();
      const project = buildProject({ userId: user.id });
      const schedules = [
        { id: "sq-1", query: "best CRM" },
        { id: "sq-2", query: "top SaaS" },
      ];
      mockProjectRepo.getById.mockResolvedValue(project);
      mockScheduleRepo.listByProject.mockResolvedValue(schedules);

      const service = buildService();
      const result = await service.list(user.id, project.id);

      expect(result).toEqual(schedules);
      expect(mockScheduleRepo.listByProject).toHaveBeenCalledWith(project.id);
    });

    it("rejects when project not found", async () => {
      mockProjectRepo.getById.mockResolvedValue(null);

      const service = buildService();
      await expect(service.list("user-1", "missing")).rejects.toThrow(
        "Project not found",
      );
    });

    it("rejects when project belongs to another user", async () => {
      const project = buildProject({ userId: "other-user" });
      mockProjectRepo.getById.mockResolvedValue(project);

      const service = buildService();
      await expect(service.list("user-1", project.id)).rejects.toThrow(
        "Project not found",
      );
    });
  });

  // -----------------------------------------------------------------
  // PATCH /:id — Update
  // -----------------------------------------------------------------
  describe("PATCH /:id — update scheduled query", () => {
    it("updates a schedule owned by user", async () => {
      const user = buildUser();
      const project = buildProject({ userId: user.id });
      const schedule = { id: "sq-1", projectId: project.id };
      mockScheduleRepo.getById.mockResolvedValue(schedule);
      mockProjectRepo.getById.mockResolvedValue(project);
      mockScheduleRepo.update.mockResolvedValue({
        ...schedule,
        frequency: "weekly",
      });

      const service = buildService();
      const result = await service.update(user.id, "sq-1", {
        frequency: "weekly",
      });

      expect(result).toEqual({ ...schedule, frequency: "weekly" });
      expect(mockScheduleRepo.update).toHaveBeenCalledWith("sq-1", {
        frequency: "weekly",
      });
    });

    it("rejects when schedule not found", async () => {
      mockScheduleRepo.getById.mockResolvedValue(null);

      const service = buildService();
      await expect(
        service.update("user-1", "missing", { frequency: "weekly" }),
      ).rejects.toThrow("Schedule not found");
    });

    it("rejects when schedule belongs to another user's project", async () => {
      const project = buildProject({ userId: "other-user" });
      const schedule = { id: "sq-1", projectId: project.id };
      mockScheduleRepo.getById.mockResolvedValue(schedule);
      mockProjectRepo.getById.mockResolvedValue(project);

      const service = buildService();
      await expect(
        service.update("user-1", "sq-1", { frequency: "weekly" }),
      ).rejects.toThrow("Not found");
    });

    it("can toggle enabled flag", async () => {
      const user = buildUser();
      const project = buildProject({ userId: user.id });
      const schedule = { id: "sq-1", projectId: project.id, enabled: true };
      mockScheduleRepo.getById.mockResolvedValue(schedule);
      mockProjectRepo.getById.mockResolvedValue(project);
      mockScheduleRepo.update.mockResolvedValue({
        ...schedule,
        enabled: false,
      });

      const service = buildService();
      const result = await service.update(user.id, "sq-1", { enabled: false });

      expect(result.enabled).toBe(false);
      expect(mockScheduleRepo.update).toHaveBeenCalledWith("sq-1", {
        enabled: false,
      });
    });

    it("rejects hourly update for starter plan", async () => {
      const user = buildUser({ plan: "starter" });
      const project = buildProject({ userId: user.id });
      const schedule = { id: "sq-1", projectId: project.id };
      mockScheduleRepo.getById.mockResolvedValue(schedule);
      mockProjectRepo.getById.mockResolvedValue(project);
      mockUserRepo.getById.mockResolvedValue(user);

      const service = buildService();
      await expect(
        service.update(user.id, "sq-1", { frequency: "hourly" }),
      ).rejects.toThrow();
    });
  });

  // -----------------------------------------------------------------
  // DELETE /:id — Delete
  // -----------------------------------------------------------------
  describe("DELETE /:id — delete scheduled query", () => {
    it("deletes a schedule owned by user", async () => {
      const user = buildUser();
      const project = buildProject({ userId: user.id });
      const schedule = { id: "sq-1", projectId: project.id };
      mockScheduleRepo.getById.mockResolvedValue(schedule);
      mockProjectRepo.getById.mockResolvedValue(project);
      mockScheduleRepo.delete.mockResolvedValue(undefined);

      const service = buildService();
      await service.delete(user.id, "sq-1");

      expect(mockScheduleRepo.delete).toHaveBeenCalledWith("sq-1");
    });

    it("rejects when schedule not found", async () => {
      mockScheduleRepo.getById.mockResolvedValue(null);

      const service = buildService();
      await expect(service.delete("user-1", "missing")).rejects.toThrow(
        "Schedule not found",
      );
    });

    it("rejects when schedule belongs to another user's project", async () => {
      const project = buildProject({ userId: "other-user" });
      const schedule = { id: "sq-1", projectId: project.id };
      mockScheduleRepo.getById.mockResolvedValue(schedule);
      mockProjectRepo.getById.mockResolvedValue(project);

      const service = buildService();
      await expect(service.delete("user-1", "sq-1")).rejects.toThrow(
        "Not found",
      );
    });
  });
});
