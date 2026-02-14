import { ERROR_CODES, letterGrade } from "@llm-boost/shared";
import type {
  ProjectRepository,
  CrawlRepository,
  PageRepository,
  ScoreRepository,
  EnrichmentRepository,
} from "../repositories";
import { ServiceError } from "./errors";

export interface PageServiceDeps {
  projects: ProjectRepository;
  crawls: CrawlRepository;
  pages: PageRepository;
  scores: ScoreRepository;
  enrichments: EnrichmentRepository;
}

export function createPageService(deps: PageServiceDeps) {
  return {
    async getPage(userId: string, pageId: string) {
      const page = await deps.pages.getById(pageId);
      if (!page) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Page not found");
      }
      await assertOwnership(userId, page.projectId);
      const { score, issues } = await deps.scores.getByPageWithIssues(pageId);
      return { ...page, score, issues };
    },

    async listPagesForJob(userId: string, jobId: string) {
      const crawl = await deps.crawls.getById(jobId);
      if (!crawl) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Crawl not found");
      }
      await assertOwnership(userId, crawl.projectId);
      const rows = await deps.scores.listByJobWithPages(jobId);
      return rows.map((row) => {
        const detail = (row.detail ?? {}) as Record<string, unknown>;
        return {
          ...(row.page ?? {}),
          id: row.page?.id ?? row.pageId,
          crawlId: row.jobId,
          overallScore: row.overallScore,
          technicalScore: row.technicalScore,
          contentScore: row.contentScore,
          aiReadinessScore: row.aiReadinessScore,
          performanceScore: (detail.performanceScore as number) ?? null,
          letterGrade: letterGrade(row.overallScore),
          issueCount: row.issueCount,
        };
      });
    },

    async listIssues(userId: string, jobId: string) {
      const crawl = await deps.crawls.getById(jobId);
      if (!crawl) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Crawl not found");
      }
      await assertOwnership(userId, crawl.projectId);
      return deps.scores.getIssuesByJob(jobId);
    },

    async listEnrichments(userId: string, pageId: string) {
      const page = await deps.pages.getById(pageId);
      if (!page) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Page not found");
      }
      await assertOwnership(userId, page.projectId);
      return deps.enrichments.listByPage(pageId);
    },
  };

  async function assertOwnership(userId: string, projectId: string) {
    const project = await deps.projects.getById(projectId);
    if (!project || project.userId !== userId) {
      const err = ERROR_CODES.NOT_FOUND;
      throw new ServiceError("NOT_FOUND", err.status, err.message);
    }
    return project;
  }
}
