import { ERROR_CODES, letterGrade } from "@llm-boost/shared";
import type {
  ProjectRepository,
  CrawlRepository,
  PageRepository,
  ScoreRepository,
  EnrichmentRepository,
} from "@llm-boost/repositories";
import { ServiceError } from "@llm-boost/shared";
import { assertProjectOwnership } from "./shared/assert-ownership";

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
      await assertProjectOwnership(deps.projects, userId, page.projectId);
      const { score, issues } = await deps.scores.getByPageWithIssues(pageId);
      return { ...page, score, issues };
    },

    async listPagesForJob(
      userId: string,
      jobId: string,
      _options?: { cursor?: string; limit?: number },
    ) {
      const crawl = await deps.crawls.getById(jobId);
      if (!crawl) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Crawl not found");
      }
      await assertProjectOwnership(deps.projects, userId, crawl.projectId);
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
          isCrossDomainRedirect:
            (detail.is_cross_domain_redirect as boolean) || false,
          redirectUrl: (detail.redirect_url as string) ?? null,
        };
      });
    },

    async listIssues(userId: string, jobId: string) {
      const crawl = await deps.crawls.getById(jobId);
      if (!crawl) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Crawl not found");
      }
      await assertProjectOwnership(deps.projects, userId, crawl.projectId);
      return deps.scores.getIssuesByJob(jobId);
    },

    async listEnrichments(userId: string, pageId: string) {
      const page = await deps.pages.getById(pageId);
      if (!page) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Page not found");
      }
      await assertProjectOwnership(deps.projects, userId, page.projectId);
      return deps.enrichments.listByPage(pageId);
    },
  };
}
