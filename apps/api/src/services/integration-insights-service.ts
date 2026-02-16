import { aggregateIntegrations } from "@llm-boost/reports";
import type {
  ProjectRepository,
  CrawlRepository,
  EnrichmentRepository,
} from "../repositories";
import { ServiceError } from "./errors";
import { assertProjectOwnership } from "./shared/assert-ownership";

export interface IntegrationInsightsDeps {
  projects: Pick<ProjectRepository, "getById">;
  crawls: Pick<CrawlRepository, "getById" | "getLatestByProject">;
  enrichments: Pick<EnrichmentRepository, "listByJob">;
}

export function createIntegrationInsightsService(
  deps: IntegrationInsightsDeps,
) {
  return {
    async getInsights(userId: string, projectId: string, crawlId?: string) {
      await assertProjectOwnership(deps.projects, userId, projectId);

      let crawl;
      if (crawlId) {
        crawl = await deps.crawls.getById(crawlId);
        if (!crawl || crawl.projectId !== projectId) {
          throw new ServiceError("NOT_FOUND", 404, "Crawl not found");
        }
      } else {
        crawl = await deps.crawls.getLatestByProject(projectId);
        if (!crawl) {
          return { crawlId: null, integrations: null };
        }
      }

      const rows = await deps.enrichments.listByJob(crawl.id);
      if (rows.length === 0) {
        return { crawlId: crawl.id, integrations: null };
      }

      const normalized = rows.map((row) => ({
        provider: row.provider,
        data: row.data as Record<string, unknown>,
      }));
      const integrations = aggregateIntegrations(normalized);
      return { crawlId: crawl.id, integrations };
    },
  };
}
