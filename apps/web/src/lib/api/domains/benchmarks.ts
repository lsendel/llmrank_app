import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type { Benchmarks } from "../types/benchmarks";

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
