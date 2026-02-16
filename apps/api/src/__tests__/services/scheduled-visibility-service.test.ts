import { describe, it, expect, vi, beforeEach } from "vitest";
import { createScheduledVisibilityService } from "../../services/scheduled-visibility-service";
import { buildUser, buildProject } from "../helpers/factories";

describe("ScheduledVisibilityService", () => {
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

  beforeEach(() => vi.clearAllMocks());

  describe("create", () => {
    it("creates a scheduled query within plan limits", async () => {
      const user = buildUser({ plan: "pro" });
      const project = buildProject({ userId: user.id });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(project);
      mockScheduleRepo.countByProject.mockResolvedValue(5);
      mockScheduleRepo.create.mockResolvedValue({ id: "sq-1" });

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      const result = await service.create({
        userId: user.id,
        projectId: project.id,
        query: "best CRM software",
        providers: ["chatgpt", "claude"],
        frequency: "daily",
      });

      expect(result).toEqual({ id: "sq-1" });
      expect(mockScheduleRepo.create).toHaveBeenCalledWith({
        projectId: project.id,
        query: "best CRM software",
        providers: ["chatgpt", "claude"],
        frequency: "daily",
      });
    });

    it("rejects hourly for starter plan", async () => {
      const user = buildUser({ plan: "starter" });
      const project = buildProject({ userId: user.id });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(project);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      await expect(
        service.create({
          userId: user.id,
          projectId: project.id,
          query: "test",
          providers: ["chatgpt"],
          frequency: "hourly",
        }),
      ).rejects.toThrow();
    });

    it("rejects for free plan", async () => {
      const user = buildUser({ plan: "free" });
      const project = buildProject({ userId: user.id });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(project);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

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

    it("rejects when schedule count reaches plan limit", async () => {
      const user = buildUser({ plan: "starter" });
      const project = buildProject({ userId: user.id });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(project);
      mockScheduleRepo.countByProject.mockResolvedValue(5); // starter limit is 5

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

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

    it("throws NOT_FOUND when user does not exist", async () => {
      mockUserRepo.getById.mockResolvedValue(null);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      await expect(
        service.create({
          userId: "nonexistent",
          projectId: "proj-1",
          query: "test",
          providers: ["chatgpt"],
          frequency: "daily",
        }),
      ).rejects.toThrow("User not found");
    });

    it("throws NOT_FOUND when project does not exist", async () => {
      const user = buildUser({ plan: "pro" });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(null);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      await expect(
        service.create({
          userId: user.id,
          projectId: "nonexistent",
          query: "test",
          providers: ["chatgpt"],
          frequency: "daily",
        }),
      ).rejects.toThrow("Project not found");
    });

    it("throws NOT_FOUND when project belongs to another user", async () => {
      const user = buildUser({ plan: "pro" });
      const project = buildProject({ userId: "other-user" });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(project);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

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

    it("allows hourly for pro plan", async () => {
      const user = buildUser({ plan: "pro" });
      const project = buildProject({ userId: user.id });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(project);
      mockScheduleRepo.countByProject.mockResolvedValue(0);
      mockScheduleRepo.create.mockResolvedValue({ id: "sq-2" });

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      const result = await service.create({
        userId: user.id,
        projectId: project.id,
        query: "test",
        providers: ["chatgpt"],
        frequency: "hourly",
      });

      expect(result).toEqual({ id: "sq-2" });
    });

    it("allows hourly for agency plan", async () => {
      const user = buildUser({ plan: "agency" });
      const project = buildProject({ userId: user.id });
      mockUserRepo.getById.mockResolvedValue(user);
      mockProjectRepo.getById.mockResolvedValue(project);
      mockScheduleRepo.countByProject.mockResolvedValue(0);
      mockScheduleRepo.create.mockResolvedValue({ id: "sq-3" });

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      const result = await service.create({
        userId: user.id,
        projectId: project.id,
        query: "test",
        providers: ["chatgpt"],
        frequency: "hourly",
      });

      expect(result).toEqual({ id: "sq-3" });
    });
  });

  describe("list", () => {
    it("returns schedules for a project owned by the user", async () => {
      const user = buildUser();
      const project = buildProject({ userId: user.id });
      const schedules = [
        { id: "sq-1", query: "best CRM" },
        { id: "sq-2", query: "top software" },
      ];
      mockProjectRepo.getById.mockResolvedValue(project);
      mockScheduleRepo.listByProject.mockResolvedValue(schedules);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      const result = await service.list(user.id, project.id);
      expect(result).toEqual(schedules);
      expect(mockScheduleRepo.listByProject).toHaveBeenCalledWith(project.id);
    });

    it("throws NOT_FOUND when project does not exist", async () => {
      mockProjectRepo.getById.mockResolvedValue(null);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      await expect(service.list("user-1", "nonexistent")).rejects.toThrow(
        "Project not found",
      );
    });

    it("throws NOT_FOUND when project belongs to another user", async () => {
      const project = buildProject({ userId: "other-user" });
      mockProjectRepo.getById.mockResolvedValue(project);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      await expect(service.list("user-1", project.id)).rejects.toThrow(
        "Project not found",
      );
    });
  });

  describe("update", () => {
    it("updates a schedule owned by the user", async () => {
      const user = buildUser();
      const project = buildProject({ userId: user.id });
      const schedule = { id: "sq-1", projectId: project.id };
      mockScheduleRepo.getById.mockResolvedValue(schedule);
      mockProjectRepo.getById.mockResolvedValue(project);
      mockScheduleRepo.update.mockResolvedValue({
        ...schedule,
        frequency: "weekly",
      });

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      const result = await service.update(user.id, "sq-1", {
        frequency: "weekly",
      });
      expect(result).toEqual({ ...schedule, frequency: "weekly" });
      expect(mockScheduleRepo.update).toHaveBeenCalledWith("sq-1", {
        frequency: "weekly",
      });
    });

    it("throws NOT_FOUND when schedule does not exist", async () => {
      mockScheduleRepo.getById.mockResolvedValue(null);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      await expect(
        service.update("user-1", "nonexistent", { frequency: "weekly" }),
      ).rejects.toThrow("Schedule not found");
    });

    it("throws NOT_FOUND when schedule belongs to another user's project", async () => {
      const project = buildProject({ userId: "other-user" });
      const schedule = { id: "sq-1", projectId: project.id };
      mockScheduleRepo.getById.mockResolvedValue(schedule);
      mockProjectRepo.getById.mockResolvedValue(project);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      await expect(
        service.update("user-1", "sq-1", { frequency: "weekly" }),
      ).rejects.toThrow("Not found");
    });

    it("rejects hourly update for starter plan", async () => {
      const user = buildUser({ plan: "starter" });
      const project = buildProject({ userId: user.id });
      const schedule = { id: "sq-1", projectId: project.id };
      mockScheduleRepo.getById.mockResolvedValue(schedule);
      mockProjectRepo.getById.mockResolvedValue(project);
      mockUserRepo.getById.mockResolvedValue(user);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      await expect(
        service.update(user.id, "sq-1", { frequency: "hourly" }),
      ).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("deletes a schedule owned by the user", async () => {
      const user = buildUser();
      const project = buildProject({ userId: user.id });
      const schedule = { id: "sq-1", projectId: project.id };
      mockScheduleRepo.getById.mockResolvedValue(schedule);
      mockProjectRepo.getById.mockResolvedValue(project);
      mockScheduleRepo.delete.mockResolvedValue(undefined);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      await service.delete(user.id, "sq-1");
      expect(mockScheduleRepo.delete).toHaveBeenCalledWith("sq-1");
    });

    it("throws NOT_FOUND when schedule does not exist", async () => {
      mockScheduleRepo.getById.mockResolvedValue(null);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      await expect(service.delete("user-1", "nonexistent")).rejects.toThrow(
        "Schedule not found",
      );
    });

    it("throws NOT_FOUND when schedule belongs to another user's project", async () => {
      const project = buildProject({ userId: "other-user" });
      const schedule = { id: "sq-1", projectId: project.id };
      mockScheduleRepo.getById.mockResolvedValue(schedule);
      mockProjectRepo.getById.mockResolvedValue(project);

      const service = createScheduledVisibilityService({
        schedules: mockScheduleRepo,
        projects: mockProjectRepo,
        users: mockUserRepo,
      });

      await expect(service.delete("user-1", "sq-1")).rejects.toThrow(
        "Not found",
      );
    });
  });
});
