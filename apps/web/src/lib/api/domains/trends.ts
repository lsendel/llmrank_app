import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type { Regression } from "../types/trends";

type TrendResponse = {
  points: Array<{
    date: string;
    overall?: number;
    technical?: number;
    content?: number;
    aiReadiness?: number;
    performance?: number;
    deltas?: {
      overall?: number;
    };
  }>;
  deltas: unknown;
};

type TrendPoint = {
  date: string;
  overall: number;
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
  delta?: number;
};

export function createTrendsApi() {
  return {
    async get(projectId: string, period = "90d"): Promise<TrendPoint[]> {
      const res = await apiClient.get<ApiEnvelope<TrendResponse>>(
        `/api/trends/${projectId}?period=${period}`,
      );
      const points = res.data?.points ?? [];

      return points.map((point) => ({
        date: point.date,
        overall: point.overall ?? 0,
        technical: point.technical ?? 0,
        content: point.content ?? 0,
        aiReadiness: point.aiReadiness ?? 0,
        performance: point.performance ?? 0,
        delta: point.deltas?.overall ?? undefined,
      }));
    },

    async getRegressions(projectId: string): Promise<Regression[]> {
      const res = await apiClient.get<ApiEnvelope<Regression[]>>(
        `/api/trends/${projectId}/regressions`,
      );
      return res.data;
    },
  };
}
