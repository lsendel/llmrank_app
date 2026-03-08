import type {
  AIScoreTrend,
  CitedPage,
  CreateScheduleInput,
  ScheduleUpdate,
  ScheduledQuery,
  SourceOpportunity,
  VisibilityGap,
  VisibilityRecommendation,
  VisibilityTrend,
  VisibilityCheck,
} from "../types/visibility";
import { apiClient } from "../core/client";
import { buildQueryString } from "../core/query";
import type { ApiEnvelope } from "../core/types";
import type { BrandPerformance } from "../types/brand";

type VisibilityFilters = { region?: string; language?: string };

type VisibilityAIScore = {
  overall: number;
  grade: string;
  breakdown: {
    llmMentions: number;
    aiSearch: number;
    shareOfVoice: number;
    backlinkAuthority: number;
  };
  meta: {
    totalChecks: number;
    llmChecks: number;
    aiModeChecks: number;
    referringDomains: number;
  };
};

type DiscoveredVisibilityKeywords = {
  gscKeywords: {
    keyword: string;
    source: string;
    clicks?: number;
    impressions?: number;
  }[];
  llmKeywords: string[];
};

function visibilityQuery(filters?: VisibilityFilters): string {
  return buildQueryString(filters);
}

export function createVisibilityApi() {
  return {
    async run(data: {
      projectId: string;
      keywordIds: string[];
      providers: string[];
      region?: string;
      language?: string;
    }): Promise<VisibilityCheck[]> {
      const res = await apiClient.post<ApiEnvelope<VisibilityCheck[]>>(
        "/api/visibility/check",
        data,
      );
      return res.data;
    },

    async suggestKeywords(projectId: string): Promise<string[]> {
      const res = await apiClient.post<ApiEnvelope<string[]>>(
        `/api/visibility/${projectId}/suggest-keywords`,
        {},
      );
      return res.data;
    },

    async list(
      projectId: string,
      filters?: VisibilityFilters,
    ): Promise<VisibilityCheck[]> {
      const qs = visibilityQuery(filters);
      const res = await apiClient.get<ApiEnvelope<VisibilityCheck[]>>(
        `/api/visibility/${projectId}${qs}`,
      );
      return res.data;
    },

    async getTrends(
      projectId: string,
      filters?: VisibilityFilters,
    ): Promise<VisibilityTrend[]> {
      const qs = visibilityQuery(filters);
      const res = await apiClient.get<ApiEnvelope<VisibilityTrend[]>>(
        `/api/visibility/${projectId}/trends${qs}`,
      );
      return res.data;
    },

    async getGaps(
      projectId: string,
      filters?: VisibilityFilters,
    ): Promise<VisibilityGap[]> {
      const qs = visibilityQuery(filters);
      const res = await apiClient.get<ApiEnvelope<VisibilityGap[]>>(
        `/api/visibility/${projectId}/gaps${qs}`,
      );
      return res.data;
    },

    async getCitedPages(
      projectId: string,
      filters?: VisibilityFilters,
    ): Promise<CitedPage[]> {
      const qs = visibilityQuery(filters);
      const res = await apiClient.get<ApiEnvelope<CitedPage[]>>(
        `/api/visibility/${projectId}/cited-pages${qs}`,
      );
      return res.data;
    },

    async getBrandPerformance(
      projectId: string,
      filters?: VisibilityFilters,
    ): Promise<BrandPerformance> {
      const qs = visibilityQuery(filters);
      const res = await apiClient.get<ApiEnvelope<BrandPerformance>>(
        `/api/visibility/${projectId}/brand-performance${qs}`,
      );
      return res.data;
    },

    async getSourceOpportunities(
      projectId: string,
      filters?: VisibilityFilters,
    ): Promise<SourceOpportunity[]> {
      const qs = visibilityQuery(filters);
      const res = await apiClient.get<ApiEnvelope<SourceOpportunity[]>>(
        `/api/visibility/${projectId}/source-opportunities${qs}`,
      );
      return res.data;
    },

    schedules: {
      async list(projectId: string): Promise<ScheduledQuery[]> {
        const res = await apiClient.get<ApiEnvelope<ScheduledQuery[]>>(
          `/api/visibility/schedules?projectId=${projectId}`,
        );
        return res.data;
      },

      async create(data: CreateScheduleInput): Promise<ScheduledQuery> {
        const res = await apiClient.post<ApiEnvelope<ScheduledQuery>>(
          "/api/visibility/schedules",
          data,
        );
        return res.data;
      },

      async update(
        id: string,
        data: Partial<ScheduleUpdate>,
      ): Promise<ScheduledQuery> {
        const res = await apiClient.patch<ApiEnvelope<ScheduledQuery>>(
          `/api/visibility/schedules/${id}`,
          data,
        );
        return res.data;
      },

      async delete(id: string): Promise<void> {
        await apiClient.delete(`/api/visibility/schedules/${id}`);
      },
    },

    async getAIScore(
      projectId: string,
      filters?: VisibilityFilters,
    ): Promise<VisibilityAIScore> {
      const qs = visibilityQuery(filters);
      const res = await apiClient.get<ApiEnvelope<VisibilityAIScore>>(
        `/api/visibility/${projectId}/ai-score${qs}`,
      );
      return res.data;
    },

    async discoverKeywords(
      projectId: string,
    ): Promise<DiscoveredVisibilityKeywords> {
      const res = await apiClient.post<
        ApiEnvelope<DiscoveredVisibilityKeywords>
      >(`/api/visibility/${projectId}/discover-keywords`, {});
      return res.data;
    },

    async getScoreTrend(
      projectId: string,
      filters?: VisibilityFilters,
    ): Promise<AIScoreTrend> {
      const qs = visibilityQuery(filters);
      const res = await apiClient.get<ApiEnvelope<AIScoreTrend>>(
        `/api/visibility/${projectId}/ai-score/trend${qs}`,
      );
      return res.data;
    },

    async getRecommendations(
      projectId: string,
      filters?: VisibilityFilters,
    ): Promise<VisibilityRecommendation[]> {
      const qs = visibilityQuery(filters);
      const res = await apiClient.get<ApiEnvelope<VisibilityRecommendation[]>>(
        `/api/visibility/${projectId}/recommendations${qs}`,
      );
      return res.data;
    },
  };
}
