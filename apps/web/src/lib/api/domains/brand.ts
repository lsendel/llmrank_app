import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type {
  BrandPerceptionProvider,
  BrandSentiment,
  BrandSentimentSnapshot,
} from "../types/brand";

type BrandFilters = { region?: string; language?: string };

function brandQuery(filters?: BrandFilters) {
  const params = new URLSearchParams();
  if (filters?.region) params.set("region", filters.region);
  if (filters?.language) params.set("language", filters.language);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function createBrandApi() {
  return {
    async getSentiment(
      projectId: string,
      filters?: BrandFilters,
    ): Promise<BrandSentiment> {
      const res = await apiClient.get<ApiEnvelope<BrandSentiment>>(
        `/api/brand/${projectId}/sentiment${brandQuery(filters)}`,
      );
      return res.data;
    },

    async getSentimentHistory(
      projectId: string,
    ): Promise<BrandSentimentSnapshot[]> {
      const res = await apiClient.get<ApiEnvelope<BrandSentimentSnapshot[]>>(
        `/api/brand/${projectId}/sentiment/history`,
      );
      return res.data;
    },

    async getPerception(
      projectId: string,
      filters?: BrandFilters,
    ): Promise<BrandPerceptionProvider[]> {
      const res = await apiClient.get<ApiEnvelope<BrandPerceptionProvider[]>>(
        `/api/brand/${projectId}/perception${brandQuery(filters)}`,
      );
      return res.data;
    },
  };
}
