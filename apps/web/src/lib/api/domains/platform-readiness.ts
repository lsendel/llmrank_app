import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type { PlatformReadinessResult } from "../types/platform-readiness";

export function createPlatformReadinessApi() {
  return {
    async get(crawlId: string): Promise<PlatformReadinessResult[]> {
      const res = await apiClient.get<ApiEnvelope<PlatformReadinessResult[]>>(
        `/api/crawls/${crawlId}/platform-readiness`,
      );
      return res.data;
    },
  };
}
