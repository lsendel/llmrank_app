import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type {
  DiscoveryResult,
  SuggestCompetitorsResponse,
} from "../types/discovery";

export function createDiscoveryApi() {
  return {
    async run(projectId: string): Promise<DiscoveryResult> {
      const res = await apiClient.post<ApiEnvelope<DiscoveryResult>>(
        `/api/discovery/${projectId}/run`,
        {},
      );
      return res.data;
    },

    async suggestCompetitors(
      projectId: string,
      input: { keywords?: string[]; goal?: string },
    ): Promise<SuggestCompetitorsResponse> {
      const res = await apiClient.post<ApiEnvelope<SuggestCompetitorsResponse>>(
        `/api/discovery/${projectId}/suggest-competitors`,
        input,
      );
      return res.data;
    },
  };
}
