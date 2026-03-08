import { apiClient } from "../core/client";
import { buildQueryString } from "../core/query";
import type { ApiEnvelope } from "../core/types";
import type {
  DashboardActivity,
  DashboardStats,
  PortfolioPriorityItem,
} from "../types/dashboard";

export function createDashboardApi() {
  return {
    async getStats(): Promise<DashboardStats> {
      const res = await apiClient.get<ApiEnvelope<DashboardStats>>(
        "/api/dashboard/stats",
      );
      return res.data;
    },

    async getRecentActivity(): Promise<DashboardActivity[]> {
      const res = await apiClient.get<ApiEnvelope<DashboardActivity[]>>(
        "/api/dashboard/activity",
      );
      return res.data;
    },

    async getPriorityFeed(limit = 15): Promise<PortfolioPriorityItem[]> {
      const qs = buildQueryString({ limit });
      const res = await apiClient.get<ApiEnvelope<PortfolioPriorityItem[]>>(
        `/api/dashboard/priority-feed${qs}`,
      );
      return res.data;
    },
  };
}
