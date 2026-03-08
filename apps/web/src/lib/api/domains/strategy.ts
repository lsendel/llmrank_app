import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type {
  GapAnalysisResult,
  SemanticGapResponse,
  StrategyCompetitor,
  StrategyPersona,
} from "../types/strategy";

type TopicMapData = {
  nodes: {
    id: string;
    label: string;
    score: number;
    wordCount: number;
    cluster: string;
    val: number;
  }[];
  edges: { source: string; target: string }[];
  clusters: { id: string; label: string }[];
};

type ApplyFixResponse = {
  suggestedSnippet: string;
  placementAdvice: string;
  citabilityBoost: number;
};

type OptimizeDimensionResponse = {
  optimized: string;
  explanation: string;
};

export function createStrategyApi() {
  return {
    async generatePersonas(
      projectId: string,
      data: { description?: string; niche?: string },
    ): Promise<StrategyPersona[]> {
      const res = await apiClient.post<ApiEnvelope<StrategyPersona[]>>(
        `/api/strategy/${projectId}/personas`,
        data,
      );
      return res.data;
    },

    async getCompetitors(projectId: string): Promise<StrategyCompetitor[]> {
      const res = await apiClient.get<ApiEnvelope<StrategyCompetitor[]>>(
        `/api/strategy/${projectId}/competitors`,
      );
      return res.data;
    },

    async addCompetitor(
      projectId: string,
      domain: string,
    ): Promise<StrategyCompetitor> {
      const res = await apiClient.post<ApiEnvelope<StrategyCompetitor>>(
        `/api/strategy/${projectId}/competitors`,
        { domain },
      );
      return res.data;
    },

    async removeCompetitor(id: string): Promise<void> {
      await apiClient.delete(`/api/strategy/competitors/${id}`);
    },

    async gapAnalysis(data: {
      projectId: string;
      competitorDomain: string;
      query: string;
      pageId?: string;
    }): Promise<GapAnalysisResult> {
      const res = await apiClient.post<ApiEnvelope<GapAnalysisResult>>(
        "/api/strategy/gap-analysis",
        data,
      );
      return res.data;
    },

    async semanticGap(data: {
      projectId: string;
      pageId: string;
      competitorDomain: string;
    }): Promise<SemanticGapResponse> {
      const res = await apiClient.post<ApiEnvelope<SemanticGapResponse>>(
        "/api/strategy/semantic-gap",
        data,
      );
      return res.data;
    },

    async applyFix(data: {
      pageId: string;
      missingFact: string;
      factType: string;
    }): Promise<ApplyFixResponse> {
      const res = await apiClient.post<ApiEnvelope<ApplyFixResponse>>(
        "/api/strategy/apply-fix",
        data,
      );
      return res.data;
    },

    async getTopicMap(projectId: string): Promise<TopicMapData> {
      const res = await apiClient.get<ApiEnvelope<TopicMapData>>(
        `/api/strategy/${projectId}/topic-map`,
      );
      return res.data;
    },

    async optimizeDimension(data: {
      pageId: string;
      content: string;
      dimension: string;
      tone?: string;
    }): Promise<OptimizeDimensionResponse> {
      const res = await apiClient.post<ApiEnvelope<OptimizeDimensionResponse>>(
        "/api/strategy/optimize-dimension",
        data,
      );
      return res.data;
    },
  };
}
