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

      const canUseDbPagination =
        health === "all" &&
        (sort === "name_asc" ||
          sort === "name_desc" ||
          sort === "created_desc" ||
          sort === "created_asc" ||
          sort === "activity_desc");

      if (canUseDbPagination) {
        const dbSort: ProjectListSort =
          sort === "activity_desc" ? "created_desc" : sort;

        const [page, total] = await Promise.all([
          deps.projects.listByUser(userId, {
            q: input.q,
            sort: dbSort,
            limit: input.limit,
            offset,
          }),
          deps.projects.countByUser(userId, { q: input.q }),
        ]);

        const data = await enrichProjectsWithLatestCrawl(page);

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
      }

      // For score-based sorting and health filters, enrich then filter/sort in-memory.
      const allProjects = await deps.projects.listByUser(userId, {
        q: input.q,
        sort: "created_desc",
      });

      const enrichedProjects = await enrichProjectsWithLatestCrawl(allProjects);

      const filtered = enrichedProjects.filter((project) =>
        matchesHealthFilter(project.latestCrawl, health),
      );

      filtered.sort((a, b) => compareProjectsForSort(a, b, sort));

      const total = filtered.length;
      const totalPages = Math.ceil(total / input.limit) || 1;
      const data = filtered.slice(offset, offset + input.limit);

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

  async function enrichProjectsWithLatestCrawl<T extends { id: string }>(
    projects: T[],
  ) {
    if (projects.length === 0) return [] as Array<T & { latestCrawl: null }>;

    const latestCrawls = await deps.crawls.getLatestByProjects(
      projects.map((project) => project.id),
    );

    const latestByProject = new Map(
      latestCrawls.map((crawl) => [crawl.projectId, crawl]),
    );
    const completedCrawlIds = latestCrawls
      .filter((crawl) => CrawlStatus.from(crawl.status).value === "complete")
      .map((crawl) => crawl.id);

    const preloadedScores = await deps.scores.listByJobs(completedCrawlIds);
    const scoresByJob = new Map<string, typeof preloadedScores>();
    for (const row of preloadedScores) {
      const bucket = scoresByJob.get(row.jobId) ?? [];
      bucket.push(row);
      scoresByJob.set(row.jobId, bucket);
    }

    return Promise.all(
      projects.map(async (project) => {
        const latestCrawl = latestByProject.get(project.id) ?? null;
        const enrichedCrawl = await enrichCrawlWithScores(
          latestCrawl,
          latestCrawl ? (scoresByJob.get(latestCrawl.id) ?? []) : null,
        );
        return { ...project, latestCrawl: enrichedCrawl };
      }),
    );
  }

  function matchesHealthFilter(
    latestCrawl: {
      status: string;
      overallScore: number | null;
    } | null,
    health: ProjectHealthFilter,
  ): boolean {
    const score = latestCrawl?.overallScore ?? null;
    const status = latestCrawl?.status;

    switch (health) {
      case "all":
        return true;
      case "good":
        return score !== null && score >= 80;
      case "needs_work":
        return score !== null && score >= 60 && score < 80;
      case "poor":
        return score !== null && score < 60;
      case "no_crawl":
        return latestCrawl == null;
      case "in_progress":
        return (
          status === "pending" || status === "crawling" || status === "scoring"
        );
      case "failed":
        return status === "failed";
      default:
        return true;
    }
  }

  function compareProjectsForSort(
    a: {
      name: string;
      createdAt: Date;
      latestCrawl?: {
        overallScore: number | null;
        completedAt: Date | null;
        startedAt: Date | null;
      } | null;
    },
    b: {
      name: string;
      createdAt: Date;
      latestCrawl?: {
        overallScore: number | null;
        completedAt: Date | null;
        startedAt: Date | null;
      } | null;
    },
    sort: ProjectListSort,
  ) {
    const aScore = a.latestCrawl?.overallScore ?? null;
    const bScore = b.latestCrawl?.overallScore ?? null;

    const aActivity = a.latestCrawl?.completedAt
      ? a.latestCrawl.completedAt.getTime()
      : a.latestCrawl?.startedAt
        ? a.latestCrawl.startedAt.getTime()
        : a.createdAt.getTime();
    const bActivity = b.latestCrawl?.completedAt
      ? b.latestCrawl.completedAt.getTime()
      : b.latestCrawl?.startedAt
        ? b.latestCrawl.startedAt.getTime()
        : b.createdAt.getTime();

    switch (sort) {
      case "name_asc":
        return a.name.localeCompare(b.name);
      case "name_desc":
        return b.name.localeCompare(a.name);
      case "created_asc":
        return a.createdAt.getTime() - b.createdAt.getTime();
      case "created_desc":
        return b.createdAt.getTime() - a.createdAt.getTime();
      case "score_desc":
        if (aScore === null && bScore === null) return 0;
        if (aScore === null) return 1;
        if (bScore === null) return -1;
        return bScore - aScore;
      case "score_asc":
        if (aScore === null && bScore === null) return 0;
        if (aScore === null) return 1;
        if (bScore === null) return -1;
        return aScore - bScore;
      case "activity_desc":
      default:
        return bActivity - aActivity;
    }
  }
}
