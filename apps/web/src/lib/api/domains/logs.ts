import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type {
  CrawlerTimelinePoint,
  LogAnalysisSummary,
  LogUpload,
} from "../types/logs";

type LogUploadResponse = {
  id: string;
  summary: LogAnalysisSummary;
};

export function createLogsApi() {
  return {
    async upload(
      projectId: string,
      data: { filename: string; content: string },
    ): Promise<LogUploadResponse> {
      const res = await apiClient.post<ApiEnvelope<LogUploadResponse>>(
        `/api/logs/${projectId}/upload`,
        data,
      );
      return res.data;
    },

    async list(projectId: string): Promise<LogUpload[]> {
      const res = await apiClient.get<ApiEnvelope<LogUpload[]>>(
        `/api/logs/${projectId}`,
      );
      return res.data;
    },

    async getCrawlerTimeline(
      projectId: string,
    ): Promise<CrawlerTimelinePoint[]> {
      const res = await apiClient.get<ApiEnvelope<CrawlerTimelinePoint[]>>(
        `/api/logs/${projectId}/crawler-timeline`,
      );
      return res.data;
    },
  };
}
