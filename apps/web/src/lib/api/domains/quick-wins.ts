import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type { QuickWin } from "../types/quick-wins";

export function createQuickWinsApi() {
  return {
    async get(crawlId: string): Promise<QuickWin[]> {
      const res = await apiClient.get<ApiEnvelope<QuickWin[]>>(
        `/api/crawls/${crawlId}/quick-wins`,
      );
      return res.data;
    },
  };
}
