import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";

type AnalyticsSummary = {
  totalPageviews: number;
  aiTraffic: {
    referral: number;
    bot: number;
    total: number;
  };
  retentionDays: number;
  trend: {
    pageviewsTrend: number | null;
    aiTrafficTrend: number | null;
  };
  byProvider?: Record<string, number>;
  topPages?: Array<{ path: string; aiVisits: number; totalVisits: number }>;
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
