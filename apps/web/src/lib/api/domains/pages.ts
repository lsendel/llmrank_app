import { apiClient } from "../core/client";
import { buildQueryString } from "../core/query";
import type { ApiEnvelope } from "../core/types";
import type { CrawledPage, PageDetail, PageEnrichment } from "../types/pages";
import type { PaginatedResponse } from "../types/pagination";

export function createPagesApi() {
  return {
    async list(
      crawlId: string,
      params?: {
        page?: number;
        limit?: number;
        sort?: string;
        order?: string;
      },
    ): Promise<PaginatedResponse<CrawledPage>> {
      const qs = buildQueryString(params);
      return apiClient.get<PaginatedResponse<CrawledPage>>(
        `/api/pages/job/${crawlId}${qs}`,
      );
    },

    async get(pageId: string): Promise<PageDetail> {
      const res = await apiClient.get<ApiEnvelope<PageDetail>>(
        `/api/pages/${pageId}`,
      );
      return res.data;
    },

    async getEnrichments(pageId: string): Promise<PageEnrichment[]> {
      const res = await apiClient.get<ApiEnvelope<PageEnrichment[]>>(
        `/api/pages/${pageId}/enrichments`,
      );
      return res.data;
    },
  };
}
