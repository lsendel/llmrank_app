import { apiClient } from "../core/client";

type CompetitorFeedOptions = {
  limit?: number;
  offset?: number;
  type?: string;
  severity?: string;
  domain?: string;
};

type UpdateMonitoringInput = {
  enabled?: boolean;
  frequency?: string;
};

type CreateWatchlistQueryInput = {
  projectId: string;
  query: string;
  providers: string[];
  frequency?: string;
};

type UpdateWatchlistQueryInput = {
  query?: string;
  providers?: string[];
  frequency?: string;
  enabled?: boolean;
};

// Preserve the existing loose response surface for this legacy area.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CompetitorMonitoringResponse = any;

export function createCompetitorMonitoringApi() {
  return {
    async getFeed(projectId: string, opts?: CompetitorFeedOptions) {
      const params = new URLSearchParams({ projectId });
      if (opts?.limit) params.set("limit", String(opts.limit));
      if (opts?.offset) params.set("offset", String(opts.offset));
      if (opts?.type) params.set("type", opts.type);
      if (opts?.severity) params.set("severity", opts.severity);
      if (opts?.domain) params.set("domain", opts.domain);

      return apiClient.get<CompetitorMonitoringResponse>(
        `/api/competitors/feed?${params}`,
      );
    },

    async getTrends(projectId: string, domain: string, period = 90) {
      const params = new URLSearchParams({
        projectId,
        domain,
        period: String(period),
      });

      return apiClient.get<CompetitorMonitoringResponse>(
        `/api/competitors/trends?${params}`,
      );
    },

    async getCadence(projectId: string) {
      return apiClient.get<CompetitorMonitoringResponse>(
        `/api/competitors/cadence?projectId=${projectId}`,
      );
    },

    async updateMonitoring(competitorId: string, data: UpdateMonitoringInput) {
      return apiClient.patch<CompetitorMonitoringResponse>(
        `/api/competitors/${competitorId}/monitoring`,
        data,
      );
    },

    async rebenchmark(competitorId: string) {
      return apiClient.post<CompetitorMonitoringResponse>(
        `/api/competitors/${competitorId}/rebenchmark`,
        {},
      );
    },

    async createWatchlistQuery(data: CreateWatchlistQueryInput) {
      return apiClient.post<CompetitorMonitoringResponse>(
        "/api/competitors/watchlist",
        data,
      );
    },

    async getWatchlist(projectId: string) {
      return apiClient.get<CompetitorMonitoringResponse>(
        `/api/competitors/watchlist?projectId=${projectId}`,
      );
    },

    async updateWatchlistQuery(id: string, data: UpdateWatchlistQueryInput) {
      return apiClient.patch<CompetitorMonitoringResponse>(
        `/api/competitors/watchlist/${id}`,
        data,
      );
    },

    async deleteWatchlistQuery(id: string) {
      return apiClient.delete<CompetitorMonitoringResponse>(
        `/api/competitors/watchlist/${id}`,
      );
    },
  };
}
