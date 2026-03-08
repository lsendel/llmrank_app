import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type {
  PipelineHealthCheckResult,
  PipelineRecommendation,
  PipelineRun,
} from "../types/pipeline";

export function createPipelineApi() {
  return {
    async recommendations(
      projectId: string,
    ): Promise<PipelineRecommendation[]> {
      const res = await apiClient.get<ApiEnvelope<PipelineRecommendation[]>>(
        `/api/pipeline/${projectId}/recommendations`,
      );
      return res.data;
    },

    async list(projectId: string): Promise<PipelineRun[]> {
      const res = await apiClient.get<ApiEnvelope<PipelineRun[]>>(
        `/api/pipeline/${projectId}`,
      );
      return res.data;
    },

    async latest(projectId: string): Promise<PipelineRun | null> {
      const res = await apiClient.get<ApiEnvelope<PipelineRun | null>>(
        `/api/pipeline/${projectId}/latest`,
      );
      return res.data;
    },

    async updateSettings(
      projectId: string,
      data: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
      const res = await apiClient.patch<ApiEnvelope<Record<string, unknown>>>(
        `/api/pipeline/${projectId}/settings`,
        data,
      );
      return res.data;
    },

    async healthCheck(projectId: string): Promise<PipelineHealthCheckResult> {
      const res = await apiClient.get<ApiEnvelope<PipelineHealthCheckResult>>(
        `/api/pipeline/${projectId}/health-check`,
      );
      return res.data;
    },
  };
}
