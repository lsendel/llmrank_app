import { apiUrl } from "../../api-base-url";
import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type { PublicReport, ShareInfo } from "../types/share";

type ShareSettings = {
  level?: "summary" | "issues" | "full";
  expiresAt?: string | null;
};

export function createShareApi() {
  return {
    async enable(crawlId: string, options?: ShareSettings): Promise<ShareInfo> {
      const res = await apiClient.post<ApiEnvelope<ShareInfo>>(
        `/api/crawls/${crawlId}/share`,
        options,
      );
      return res.data;
    },

    async update(crawlId: string, settings: ShareSettings): Promise<ShareInfo> {
      const res = await apiClient.patch<ApiEnvelope<ShareInfo>>(
        `/api/crawls/${crawlId}/share`,
        settings,
      );
      return res.data;
    },

    async disable(crawlId: string): Promise<void> {
      await apiClient.delete(`/api/crawls/${crawlId}/share`);
    },

    async getPublicReport(token: string): Promise<PublicReport> {
      const res = await fetch(apiUrl(`/api/public/reports/${token}`));
      if (!res.ok) throw new Error("Report not found");
      const json = (await res.json()) as ApiEnvelope<PublicReport>;
      return json.data;
    },
  };
}
