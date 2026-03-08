import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type { SavedKeyword } from "../types/keywords";

export function createKeywordsApi() {
  return {
    async list(projectId: string): Promise<SavedKeyword[]> {
      const res = await apiClient.get<ApiEnvelope<SavedKeyword[]>>(
        `/api/keywords/${projectId}`,
      );
      return res.data;
    },

    async create(
      projectId: string,
      data: { keyword: string; funnelStage?: string; personaId?: string },
    ): Promise<SavedKeyword> {
      const res = await apiClient.post<ApiEnvelope<SavedKeyword>>(
        `/api/keywords/${projectId}`,
        data,
      );
      return res.data;
    },

    async remove(id: string): Promise<void> {
      await apiClient.delete(`/api/keywords/${id}`);
    },

    async createBatch(
      projectId: string,
      keywords: string[],
    ): Promise<SavedKeyword[]> {
      const res = await apiClient.post<ApiEnvelope<SavedKeyword[]>>(
        `/api/keywords/${projectId}/batch`,
        { keywords },
      );
      return res.data;
    },
  };
}
