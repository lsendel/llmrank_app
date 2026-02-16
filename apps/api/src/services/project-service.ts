import {
  ERROR_CODES,
  aggregatePageScores,
  canCreateProject,
  getLimits,
} from "@llm-boost/shared";
import type {
  ProjectRepository,
  UserRepository,
  CrawlRepository,
  ScoreRepository,
} from "../repositories";
import { ServiceError } from "./errors";
import { toAggregateInput } from "./score-helpers";

interface PaginationInput {
  page: number;
  limit: number;
}

export interface ProjectServiceDeps {
  projects: ProjectRepository;
  users: UserRepository;
  crawls: CrawlRepository;
  scores: ScoreRepository;
}

export function createProjectService(deps: ProjectServiceDeps) {
  return {
    async listForUser(userId: string, pagination: PaginationInput) {
      const allProjects = await deps.projects.listByUser(userId);
      const total = allProjects.length;
      const totalPages = Math.ceil(total / pagination.limit) || 1;
      const start = (pagination.page - 1) * pagination.limit;
      const data = allProjects.slice(start, start + pagination.limit);

      return { data, pagination: { ...pagination, total, totalPages } };
    },

    async createProject(
      userId: string,
      payload: { name: string; domain: string },
    ) {
      const user = await deps.users.getById(userId);
      if (!user) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "User not found");
      }

      const existingProjects = await deps.projects.listByUser(userId);
      if (!canCreateProject(user.plan, existingProjects.length)) {
        const err = ERROR_CODES.PLAN_LIMIT_REACHED;
        const limits = getLimits(user.plan);
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          err.status,
          `Your ${user.plan} plan allows a maximum of ${limits.projects} project(s). Upgrade to add more.`,
        );
      }

      return deps.projects.create({
        userId,
        name: payload.name,
        domain: payload.domain,
      });
    },

    async getProjectDetail(userId: string, projectId: string) {
      const project = await deps.projects.getById(projectId);
      if (!project || project.userId !== userId) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, err.message);
      }

      const latestCrawl = await deps.crawls.getLatestByProject(projectId);
      const enrichedCrawl = await enrichCrawlWithScores(latestCrawl);

      return { ...project, latestCrawl: enrichedCrawl };
    },

    async updateProject(
      userId: string,
      projectId: string,
      payload: { name?: string; settings?: unknown; branding?: unknown },
    ) {
      const existing = await deps.projects.getById(projectId);
      if (!existing || existing.userId !== userId) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, err.message);
      }
      return deps.projects.update(projectId, payload);
    },

    async deleteProject(userId: string, projectId: string) {
      const existing = await deps.projects.getById(projectId);
      if (!existing || existing.userId !== userId) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, err.message);
      }
      await deps.projects.delete(projectId);
      return { id: projectId, deleted: true };
    },
  };

  async function enrichCrawlWithScores(
    crawlJob: Awaited<ReturnType<CrawlRepository["getById"]>> | null,
  ) {
    if (!crawlJob) return null;
    if (crawlJob.status !== "complete") {
      return {
        ...crawlJob,
        overallScore: null as number | null,
        letterGrade: null as string | null,
        scores: null as {
          technical: number;
          content: number;
          aiReadiness: number;
          performance: number;
        } | null,
      };
    }

    const pageScores = await deps.scores.listByJob(crawlJob.id);
    if (pageScores.length === 0) {
      return {
        ...crawlJob,
        overallScore: null as number | null,
        letterGrade: null as string | null,
        scores: null as {
          technical: number;
          content: number;
          aiReadiness: number;
          performance: number;
        } | null,
      };
    }

    return {
      ...crawlJob,
      ...aggregatePageScores(toAggregateInput(pageScores)),
    };
  }
}
