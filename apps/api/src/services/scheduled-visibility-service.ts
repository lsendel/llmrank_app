import { PLAN_LIMITS } from "@llm-boost/shared";
import { ServiceError } from "./errors";

interface ScheduledVisibilityServiceDeps {
  schedules: {
    create(data: any): Promise<any>;
    listByProject(projectId: string): Promise<any[]>;
    getById(id: string): Promise<any>;
    update(id: string, data: any): Promise<any>;
    delete(id: string): Promise<void>;
    countByProject(projectId: string): Promise<number>;
  };
  projects: { getById(id: string): Promise<any> };
  users: { getById(id: string): Promise<any> };
}

export function createScheduledVisibilityService(
  deps: ScheduledVisibilityServiceDeps,
) {
  return {
    async create(args: {
      userId: string;
      projectId: string;
      query: string;
      providers: string[];
      frequency: "hourly" | "daily" | "weekly";
    }) {
      const user = await deps.users.getById(args.userId);
      if (!user) throw new ServiceError("NOT_FOUND", 404, "User not found");

      const project = await deps.projects.getById(args.projectId);
      if (!project || project.userId !== args.userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }

      const limits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS];
      if (limits.scheduledQueries === 0) {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "PLAN_LIMIT_REACHED: Scheduled queries not available on your plan",
        );
      }

      if (user.plan === "starter" && args.frequency === "hourly") {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "PLAN_LIMIT_REACHED: Hourly scheduling requires Pro or Agency plan",
        );
      }

      const count = await deps.schedules.countByProject(args.projectId);
      if (count >= limits.scheduledQueries) {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          `PLAN_LIMIT_REACHED: Limit of ${limits.scheduledQueries} scheduled queries reached`,
        );
      }

      return deps.schedules.create({
        projectId: args.projectId,
        query: args.query,
        providers: args.providers,
        frequency: args.frequency,
      });
    },

    async list(userId: string, projectId: string) {
      const project = await deps.projects.getById(projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }
      return deps.schedules.listByProject(projectId);
    },

    async update(userId: string, scheduleId: string, data: any) {
      const schedule = await deps.schedules.getById(scheduleId);
      if (!schedule)
        throw new ServiceError("NOT_FOUND", 404, "Schedule not found");

      const project = await deps.projects.getById(schedule.projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Not found");
      }

      if (data.frequency === "hourly") {
        const user = await deps.users.getById(userId);
        if (user?.plan === "starter") {
          throw new ServiceError(
            "PLAN_LIMIT_REACHED",
            403,
            "PLAN_LIMIT_REACHED: Hourly requires Pro or Agency",
          );
        }
      }

      return deps.schedules.update(scheduleId, data);
    },

    async delete(userId: string, scheduleId: string) {
      const schedule = await deps.schedules.getById(scheduleId);
      if (!schedule)
        throw new ServiceError("NOT_FOUND", 404, "Schedule not found");

      const project = await deps.projects.getById(schedule.projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Not found");
      }

      await deps.schedules.delete(scheduleId);
    },
  };
}
