import { normalizeDomain } from "@llm-boost/shared";
import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type {
  IntegrationCatalogItem,
  PublicScanResult,
  SharedReport,
} from "../types/public";

export function createPublicApi() {
  return {
    async scan(
      url: string,
    ): Promise<PublicScanResult & { scanResultId?: string }> {
      const domain = normalizeDomain(url);
      const res = await apiClient.post<
        ApiEnvelope<PublicScanResult & { scanResultId?: string }>
      >("/api/public/scan", { url: domain });
      return res.data;
    },

    async getReport(token: string): Promise<SharedReport> {
      const res = await apiClient.get<ApiEnvelope<SharedReport>>(
        `/api/public/reports/${token}`,
      );
      return res.data;
    },

    async getScanResult(id: string, token?: string): Promise<PublicScanResult> {
      const params = token ? `?token=${token}` : "";
      const res = await apiClient.get<ApiEnvelope<PublicScanResult>>(
        `/api/public/scan-results/${id}${params}`,
      );
      return res.data;
    },

    async captureLead(data: {
      email: string;
      reportToken?: string;
      scanResultId?: string;
    }): Promise<{ id: string }> {
      const res = await apiClient.post<ApiEnvelope<{ id: string }>>(
        "/api/public/leads",
        data,
      );
      return res.data;
    },

    async leaderboard(): Promise<
      {
        projectId: string;
        domain: string;
        overallScore: number;
        grade: string;
        aiReadinessScore: number;
      }[]
    > {
      const res = await apiClient.get<
        ApiEnvelope<
          {
            projectId: string;
            domain: string;
            overallScore: number;
            grade: string;
            aiReadinessScore: number;
          }[]
        >
      >("/api/public/leaderboard");
      return res.data;
    },

    async integrationCatalog(): Promise<IntegrationCatalogItem[]> {
      const res = await apiClient.get<ApiEnvelope<IntegrationCatalogItem[]>>(
        "/api/integrations/catalog",
      );
      return res.data;
    },

    async isHttpFallbackEnabled(): Promise<boolean> {
      const res = await apiClient.get<{ enabled: boolean }>(
        "/api/public/settings/http-fallback",
      );
      return res.enabled;
    },
  };
}
