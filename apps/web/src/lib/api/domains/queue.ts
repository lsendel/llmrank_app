import { apiClient } from "../core/client";
import type { CrawlJobSummary } from "../types/crawls";
import type { PaginatedResponse } from "../types/pagination";

export function createQueueApi() {
  return {
    list(params?: {
      page?: number;
      limit?: number;
    }): Promise<PaginatedResponse<CrawlJobSummary>> {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", params.page.toString());
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
      return apiClient.get<PaginatedResponse<CrawlJobSummary>>(
        `/api/queue${qs}`,
      );
    },
  };
}
