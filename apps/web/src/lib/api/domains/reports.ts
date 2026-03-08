import { apiUrl } from "../../api-base-url";
import { apiClient } from "../core/client";
import { ApiError } from "../core/errors";
import type { ApiEnvelope } from "../core/types";
import type { Report, ReportSchedule } from "../types/reports";

type GenerateReportInput = {
  projectId: string;
  crawlJobId: string;
  type: "summary" | "detailed";
  format: "pdf" | "docx";
  config?: {
    compareCrawlIds?: string[];
    brandingColor?: string;
    preparedFor?: string;
  };
};

type CreateReportScheduleInput = {
  projectId: string;
  format: "pdf" | "docx";
  type: "summary" | "detailed";
  recipientEmail: string;
};

type UpdateReportScheduleInput = Partial<{
  format: "pdf" | "docx";
  type: "summary" | "detailed";
  recipientEmail: string;
  enabled: boolean;
}>;

export function createReportsApi() {
  return {
    async generate(input: GenerateReportInput): Promise<Report> {
      const res = await apiClient.post<ApiEnvelope<Report>>(
        "/api/reports/generate",
        input,
      );
      return res.data;
    },

    async list(projectId: string): Promise<Report[]> {
      const res = await apiClient.get<ApiEnvelope<Report[]>>(
        `/api/reports?projectId=${projectId}`,
      );
      return res.data;
    },

    async getStatus(reportId: string): Promise<Report> {
      const res = await apiClient.get<ApiEnvelope<Report>>(
        `/api/reports/${reportId}`,
      );
      return res.data;
    },

    async download(reportId: string): Promise<Blob> {
      const res = await fetch(apiUrl(`/api/reports/${reportId}/download`), {
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Report download failed:", res.status, text);

        let err;
        try {
          err = JSON.parse(text);
        } catch {
          err = {
            error: { code: "DOWNLOAD_ERROR", message: "Download failed" },
          };
        }

        throw new ApiError(
          res.status,
          err.error?.code ?? "DOWNLOAD_ERROR",
          err.error?.message ?? "Download failed",
        );
      }

      return res.blob();
    },

    async delete(reportId: string): Promise<void> {
      await apiClient.delete(`/api/reports/${reportId}`);
    },

    schedules: {
      async list(projectId: string): Promise<ReportSchedule[]> {
        const res = await apiClient.get<ApiEnvelope<ReportSchedule[]>>(
          `/api/reports/schedules?projectId=${projectId}`,
        );
        return res.data;
      },

      async create(data: CreateReportScheduleInput): Promise<ReportSchedule> {
        const res = await apiClient.post<ApiEnvelope<ReportSchedule>>(
          "/api/reports/schedules",
          data,
        );
        return res.data;
      },

      async update(
        id: string,
        data: UpdateReportScheduleInput,
      ): Promise<ReportSchedule> {
        const res = await apiClient.patch<ApiEnvelope<ReportSchedule>>(
          `/api/reports/schedules/${id}`,
          data,
        );
        return res.data;
      },

      async delete(id: string): Promise<void> {
        await apiClient.delete(`/api/reports/schedules/${id}`);
      },
    },
  };
}
