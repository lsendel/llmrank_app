import { apiUrl } from "../../api-base-url";
import { apiClient } from "../core/client";
import { ApiError } from "../core/errors";
import { buildQueryString } from "../core/query";
import type { ApiEnvelope } from "../core/types";
import type {
  AIAuditResult,
  ComparisonItem,
  CrawlInsights,
  CrawlJob,
  FusedInsights,
  IssueHeatmapData,
} from "../types/crawls";
import type { PaginatedResponse } from "../types/pagination";

export function createCrawlsApi() {
  return {
    async start(projectId: string): Promise<CrawlJob> {
      const res = await apiClient.post<ApiEnvelope<CrawlJob>>("/api/crawls", {
        projectId,
      });
      return res.data;
    },

    async getHistory(
      page: number = 1,
      limit: number = 50,
    ): Promise<PaginatedResponse<CrawlJob>> {
      const qs = buildQueryString({ page, limit });
      return apiClient.get<PaginatedResponse<CrawlJob>>(
        `/api/crawls/history${qs}`,
      );
    },

    async deleteHistory(projectId?: string): Promise<{ deleted: number }> {
      const qs = projectId ? `?projectId=${projectId}` : "";
      const res = await apiClient.delete<ApiEnvelope<{ deleted: number }>>(
        `/api/crawls/history${qs}`,
      );
      return res.data;
    },

    async list(
      projectId: string,
      params?: { page?: number; limit?: number },
    ): Promise<PaginatedResponse<CrawlJob>> {
      const qs = buildQueryString(params);
      return apiClient.get<PaginatedResponse<CrawlJob>>(
        `/api/crawls/project/${projectId}${qs}`,
      );
    },

    async get(
      crawlId: string,
      options?: { signal?: AbortSignal },
    ): Promise<CrawlJob> {
      const res = await apiClient.get<ApiEnvelope<CrawlJob>>(
        `/api/crawls/${crawlId}`,
        options,
      );
      return res.data;
    },

    async getInsights(crawlId: string): Promise<CrawlInsights> {
      const res = await apiClient.get<ApiEnvelope<CrawlInsights>>(
        `/api/crawls/${crawlId}/insights`,
      );
      return res.data;
    },

    async getAIAudit(crawlId: string): Promise<AIAuditResult> {
      const res = await apiClient.get<ApiEnvelope<AIAuditResult>>(
        `/api/crawls/${crawlId}/ai-audit`,
      );
      return res.data;
    },

    async exportData(
      crawlId: string,
      format: "csv" | "json",
    ): Promise<string | unknown[]> {
      if (format === "csv") {
        const res = await fetch(
          apiUrl(`/api/crawls/${crawlId}/export?format=csv`),
          {
            headers: { Accept: "text/csv" },
            credentials: "include",
          },
        );
        if (!res.ok) {
          throw new ApiError(res.status, "EXPORT_FAILED", "Export failed");
        }
        return res.text();
      }

      const res = await apiClient.get<ApiEnvelope<unknown[]>>(
        `/api/crawls/${crawlId}/export?format=json`,
      );
      return res.data;
    },

    async getIssueHeatmap(crawlId: string): Promise<IssueHeatmapData> {
      const res = await apiClient.get<ApiEnvelope<IssueHeatmapData>>(
        `/api/crawls/${crawlId}/issue-heatmap`,
      );
      return res.data;
    },

    async fusedInsights(crawlId: string): Promise<FusedInsights> {
      const res = await apiClient.get<ApiEnvelope<FusedInsights>>(
        `/api/crawls/${crawlId}/fused-insights`,
      );
      return res.data;
    },

    async getProjectHistory(
      projectId: string,
      limit: number = 50,
    ): Promise<ApiEnvelope<CrawlJob[]>> {
      return apiClient.get<ApiEnvelope<CrawlJob[]>>(
        `/api/crawls/project/${projectId}/history?limit=${limit}`,
      );
    },

    async compare(
      crawlId: string,
      otherId: string,
    ): Promise<ApiEnvelope<ComparisonItem[]>> {
      return apiClient.get<ApiEnvelope<ComparisonItem[]>>(
        `/api/crawls/${crawlId}/compare/${otherId}`,
      );
    },
  };
}
