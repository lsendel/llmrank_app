import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type { CrawlJobSummary } from "../types/crawls";
import type { PaginatedResponse } from "../types/pagination";

export function createFixesApi() {
  return {
    async generate(data: {
      projectId: string;
      pageId?: string;
      issueCode: string;
    }): Promise<{ generatedFix: string; fixType: string }> {
      const res = await apiClient.post<
        ApiEnvelope<{ generatedFix: string; fixType: string }>
      >("/api/fixes/generate", data);
      return res.data;
    },

    async getHistory(page = 1, limit = 50) {
      return apiClient.get<PaginatedResponse<CrawlJobSummary>>(
        `/crawls/history?page=${page}&limit=${limit}`,
      );
    },

    async list(projectId: string) {
      const res = await apiClient.get<ApiEnvelope<unknown[]>>(
        `/api/fixes?projectId=${projectId}`,
      );
      return res.data;
    },

    async supported() {
      const res = await apiClient.get<ApiEnvelope<string[]>>(
        "/api/fixes/supported",
      );
      return res.data;
    },

    async generateBatch(data: { projectId: string; crawlId: string }) {
      const res = await apiClient.post<
        ApiEnvelope<
          Array<{
            code: string;
            fix: { generatedFix: string; fixType: string } | null;
            error: string | null;
          }>
        >
      >("/api/fixes/generate-batch", data);
      return res.data;
    },
  };
}
