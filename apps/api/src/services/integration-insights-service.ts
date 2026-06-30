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
        const crawlDate = crawl.createdAt;
        if (rows.length === 0) {
          return {
            crawlId: crawl.id,
            crawlDate,
            integrations: {
              gsc: null,
              ga4: null,
              clarity: null,
              meta: null,
              psi: null,
              cloudflare: null,
            },
          };
        }
        const normalized = rows.map((row) => ({
          provider: row.provider,
          data: (typeof row.data === "string"
            ? JSON.parse(row.data)
            : row.data) as Record<string, unknown>,
        }));
        return {
          crawlId: crawl.id,
          crawlDate,
          integrations: aggregateIntegrations(normalized),
        };
      }

      // Prefer completed crawls for dashboard insights. An in-flight crawl will
      // not have final enrichment rows yet, so anchoring the integrations tab to
      // it makes previously available provider data disappear while crawling.
      const recentCrawls = await deps.crawls.listByProject(projectId);
      if (recentCrawls.length === 0) {
        return { crawlId: null, crawlDate: null, integrations: null };
      }

      const completedCrawls = recentCrawls.filter(
        (crawl) => crawl.status === "complete",
      );
      const candidateCrawls =
        completedCrawls.length > 0 ? completedCrawls : recentCrawls;

      for (const crawl of candidateCrawls) {
        const rows = await deps.enrichments.listByJob(crawl.id);
        if (rows.length > 0) {
          const normalized = rows.map((row) => ({
            provider: row.provider,
            data: (typeof row.data === "string"
              ? JSON.parse(row.data)
              : row.data) as Record<string, unknown>,
          }));
          const integrations = aggregateIntegrations(normalized);
          const crawlDate = crawl.createdAt;
          return { crawlId: crawl.id, crawlDate, integrations };
        }
      }

      // No candidate crawl has enrichments yet.
      const latestCrawl = candidateCrawls[0];
      const crawlDate = latestCrawl.createdAt;
      return {
        crawlId: latestCrawl.id,
        crawlDate,
        integrations: {
          gsc: null,
          ga4: null,
          clarity: null,
          meta: null,
          psi: null,
          cloudflare: null,
        },
      };
    },
  };
}
