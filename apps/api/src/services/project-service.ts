import {
  ERROR_CODES,
  aggregatePageScores,
  Plan,
  CrawlStatus,
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

type ProjectListSort =
  | "activity_desc"
  | "score_desc"
  | "score_asc"
  | "name_asc"
  | "name_desc"
  | "created_desc"
  | "created_asc";

type ProjectHealthFilter =
  | "all"
  | "good"
  | "needs_work"
  | "poor"
  | "no_crawl"
  | "in_progress"
  | "failed";

interface ProjectListInput extends PaginationInput {
  q?: string;
  sort?: ProjectListSort;
  health?: ProjectHealthFilter;
}

export interface ProjectServiceDeps {
  projects: ProjectRepository;
  users: UserRepository;
  crawls: CrawlRepository;
  scores: ScoreRepository;
}

export function createProjectService(deps: ProjectServiceDeps) {
  return {
    async listForUser(userId: string, input: ProjectListInput) {
      const sort = input.sort ?? "activity_desc";
      const health = input.health ?? "all";
      const offset = (input.page - 1) * input.limit;
      const [data, total] = await Promise.all([
        deps.projects.listPortfolioByUser(userId, {
          q: input.q,
          sort,
          health,
          limit: input.limit,
          offset,
        }),
        deps.projects.countPortfolioByUser(userId, {
          q: input.q,
          health,
        }),
      ]);
      const totalPages = Math.ceil(total / input.limit) || 1;

      return {
        data,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages,
        },
      };
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

      const existingProjectCount = await deps.projects.countByUser(userId);
      const plan = Plan.from(user.plan);
      if (!plan.canCreateProject(existingProjectCount)) {
        const err = ERROR_CODES.PLAN_LIMIT_REACHED;
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          err.status,
          `Your ${user.plan} plan allows a maximum of ${plan.maxProjects} project(s). Upgrade to add more.`,
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
    preloadedScores?: Awaited<ReturnType<ScoreRepository["listByJob"]>> | null,
  ) {
    if (!crawlJob) return null;
    const status = CrawlStatus.from(crawlJob.status);
    if (status.value !== "complete") {
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

    const pageScores =
      preloadedScores ?? (await deps.scores.listByJob(crawlJob.id));
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
