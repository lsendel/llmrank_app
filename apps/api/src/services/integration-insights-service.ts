import { aggregateIntegrations } from "@llm-boost/reports";
import type {
  ProjectRepository,
  CrawlRepository,
  EnrichmentRepository,
} from "@llm-boost/repositories";
import { ServiceError } from "@llm-boost/shared";
import { assertProjectOwnership } from "./shared/assert-ownership";

export interface IntegrationInsightsDeps {
  projects: Pick<ProjectRepository, "getById">;
  crawls: Pick<CrawlRepository, "getById" | "listByProject">;
  enrichments: Pick<EnrichmentRepository, "listByJob">;
}

export function createIntegrationInsightsService(
  deps: IntegrationInsightsDeps,
) {
  return {
    async getInsights(userId: string, projectId: string, crawlId?: string) {
      await assertProjectOwnership(deps.projects, userId, projectId);

      if (crawlId) {
        const crawl = await deps.crawls.getById(crawlId);
        if (!crawl || crawl.projectId !== projectId) {
          throw new ServiceError("NOT_FOUND", 404, "Crawl not found");
        }
        const rows = await deps.enrichments.listByJob(crawl.id);
        const crawlDate = crawl.createdAt.toISOString();
        if (rows.length === 0) {
          return {
            crawlId: crawl.id,
            crawlDate,
            integrations: { gsc: null, ga4: null, clarity: null, meta: null },
          };
        }
        const normalized = rows.map((row) => ({
          provider: row.provider,
          data: row.data as Record<string, unknown>,
        }));
        return {
          crawlId: crawl.id,
          crawlDate,
          integrations: aggregateIntegrations(normalized),
        };
      }

      // Try the latest crawl first; if it has no enrichments, walk back
      // through recent completed crawls to find one that does.
      const recentCrawls = await deps.crawls.listByProject(projectId);
      if (recentCrawls.length === 0) {
        return { crawlId: null, crawlDate: null, integrations: null };
      }

      for (const crawl of recentCrawls) {
        const rows = await deps.enrichments.listByJob(crawl.id);
        if (rows.length > 0) {
          const normalized = rows.map((row) => ({
            provider: row.provider,
            data: row.data as Record<string, unknown>,
          }));
          const integrations = aggregateIntegrations(normalized);
          const crawlDate = crawl.createdAt.toISOString();
          return { crawlId: crawl.id, crawlDate, integrations };
        }
      }

      // No crawl has enrichments yet
      const latestCrawl = recentCrawls[0];
      const crawlDate = latestCrawl.createdAt.toISOString();
      return {
        crawlId: latestCrawl.id,
        crawlDate,
        integrations: { gsc: null, ga4: null, clarity: null, meta: null },
      };
    },
  };
}
