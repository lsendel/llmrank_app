import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type { PageScoreDetail, PageScoreEntry } from "../types/scores";

export function createScoresApi() {
  return {
    async listByJob(jobId: string): Promise<PageScoreEntry[]> {
      const res = await apiClient.get<ApiEnvelope<PageScoreEntry[]>>(
        `/api/scores/job/${jobId}/pages`,
      );
      return res.data;
    },

    async getPage(pageId: string): Promise<PageScoreDetail> {
      const res = await apiClient.get<ApiEnvelope<PageScoreDetail>>(
        `/api/scores/page/${pageId}`,
      );
      return res.data;
    },
  };
}
