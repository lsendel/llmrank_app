import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";

type AnalyticsSummary = {
  period: string;
  totalVisits: number;
  aiTraffic: {
    total: number;
    byProvider: Array<{ provider: string; visits: number; type: string }>;
    trend: string | null;
  };
  topPages: Array<{ path: string; aiVisits: number; totalVisits: number }>;
  trend: {
    pageviewsTrend: number | null;
    aiTrafficTrend: number | null;
  };
};

type AiTrafficData = {
  data: Array<{
    date: string;
    sourceType: string;
    aiProvider: string;
    count: number;
  }>;
};

export function createAnalyticsApi() {
  return {
    async getSummary(projectId: string): Promise<AnalyticsSummary> {
      const res = await apiClient.get<ApiEnvelope<AnalyticsSummary>>(
        `/api/analytics/${projectId}/summary`,
      );
      return res.data;
    },

    async getAiTraffic(projectId: string): Promise<AiTrafficData> {
      const res = await apiClient.get<ApiEnvelope<AiTrafficData>>(
        `/api/analytics/${projectId}/ai-traffic`,
      );
      return res.data;
    },
  };
}
