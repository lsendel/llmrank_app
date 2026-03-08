import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type { DiscoveryResult } from "../types/discovery";

export function createDiscoveryApi() {
  return {
    async run(projectId: string): Promise<DiscoveryResult> {
      const res = await apiClient.post<ApiEnvelope<DiscoveryResult>>(
        `/api/discovery/${projectId}/run`,
        {},
      );
      return res.data;
    },
  };
}
