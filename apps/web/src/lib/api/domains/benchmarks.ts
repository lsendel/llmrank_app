import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type { Benchmarks, CompetitorInsight } from "../types/benchmarks";

type BenchmarksListResponse = {
  projectScores: Record<string, number>;
  competitors: Array<{
    competitorDomain: string;
    scores: Record<string, number>;
    comparison: Record<string, number>;
    crawledAt: string;
  }>;
};

export function createBenchmarksApi() {
  return {
    async get(): Promise<Benchmarks | null> {
      const res = await apiClient.get<ApiEnvelope<Benchmarks | null>>(
        "/api/public/benchmarks",
      );
      return res.data;
    },

    async list(projectId: string): Promise<BenchmarksListResponse> {
      const res = await apiClient.get<ApiEnvelope<BenchmarksListResponse>>(
        `/api/competitors?projectId=${projectId}`,
      );
      return res.data;
    },

    async insights(
      projectId: string,
      filters?: { region?: string; language?: string },
    ): Promise<CompetitorInsight[]> {
      const params = new URLSearchParams({ projectId });
      if (filters?.region) params.set("region", filters.region);
      if (filters?.language) params.set("language", filters.language);

      const res = await apiClient.get<ApiEnvelope<CompetitorInsight[]>>(
        `/api/competitors/insights?${params.toString()}`,
      );
      return res.data;
    },

    async trigger(data: {
      projectId: string;
      competitorDomain: string;
    }): Promise<void> {
      await apiClient.post(`/api/competitors/benchmark`, {
        projectId: data.projectId,
        competitorDomain: data.competitorDomain,
      });
    },
  };
}
