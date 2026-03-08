import { apiClient } from "../core/client";
import { buildQueryString } from "../core/query";
import type { PageIssue } from "../types/pages";
import type { PaginatedResponse } from "../types/pagination";

export function createIssuesApi() {
  return {
    async listForCrawl(
      crawlId: string,
      params?: {
        page?: number;
        limit?: number;
        severity?: string;
        category?: string;
      },
    ): Promise<PaginatedResponse<PageIssue>> {
      const qs = buildQueryString(params);
      return apiClient.get<PaginatedResponse<PageIssue>>(
        `/api/pages/issues/job/${crawlId}${qs}`,
      );
    },
  };
}
