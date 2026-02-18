import { ServiceError } from "./errors";

interface GSCQuery {
  query: string;
  clicks: number;
  impressions: number;
}

interface KeywordSuggestion {
  keyword: string;
  source: "gsc" | "llm";
  clicks?: number;
  impressions?: number;
}

interface KeywordDiscoveryDeps {
  projects: { getById(id: string): Promise<any> };
  enrichments: {
    listByJobAndProvider(jobId: string, provider: string): Promise<any[]>;
  };
  schedules: {
    listByProject(
      projectId: string,
      limit?: number,
      offset?: number,
    ): Promise<any[]>;
  };
  crawls: { getLatestByProject(projectId: string): Promise<any> };
  llm: { generateKeywords(domain: string, context: string): Promise<string[]> };
}

export function createKeywordDiscoveryService(deps: KeywordDiscoveryDeps) {
  return {
    async discover(
      userId: string,
      projectId: string,
    ): Promise<{
      gscKeywords: KeywordSuggestion[];
      llmKeywords: string[];
    }> {
      const project = await deps.projects.getById(projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }

      // Get already-tracked keywords to exclude
      const tracked = await deps.schedules.listByProject(projectId);
      const trackedSet = new Set(
        tracked.map((s: any) => s.query.toLowerCase()),
      );

      // Phase 1: GSC-based keywords
      const gscKeywords: KeywordSuggestion[] = [];
      const latestCrawl = await deps.crawls.getLatestByProject(projectId);

      if (latestCrawl) {
        const enrichments = await deps.enrichments.listByJobAndProvider(
          latestCrawl.id,
          "gsc",
        );

        const allQueries = new Map<string, GSCQuery>();
        for (const enrichment of enrichments) {
          const queries = (enrichment.data as any)?.queries ?? [];
          for (const q of queries) {
            const key = q.query.toLowerCase();
            if (
              !allQueries.has(key) ||
              allQueries.get(key)!.clicks < q.clicks
            ) {
              allQueries.set(key, q);
            }
          }
        }

        // Sort by impressions descending, take top 30, exclude tracked
        const sorted = Array.from(allQueries.values())
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 30);

        for (const q of sorted) {
          if (!trackedSet.has(q.query.toLowerCase())) {
            gscKeywords.push({
              keyword: q.query,
              source: "gsc",
              clicks: q.clicks,
              impressions: q.impressions,
            });
          }
        }
      }

      // Phase 2: LLM-based keyword expansion
      const gscContext = gscKeywords
        .slice(0, 10)
        .map((k) => k.keyword)
        .join(", ");

      const llmSuggestions = await deps.llm.generateKeywords(
        project.domain,
        gscContext,
      );

      // Deduplicate against tracked + GSC keywords
      const gscSet = new Set(gscKeywords.map((k) => k.keyword.toLowerCase()));
      const llmKeywords = llmSuggestions.filter(
        (kw) =>
          !trackedSet.has(kw.toLowerCase()) && !gscSet.has(kw.toLowerCase()),
      );

      return { gscKeywords, llmKeywords };
    },
  };
}
