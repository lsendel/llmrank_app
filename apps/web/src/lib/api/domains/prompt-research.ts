import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type { AIPrompt, PromptCheckResult } from "../types/prompt-research";

export function createPromptResearchApi() {
  return {
    async discover(projectId: string): Promise<AIPrompt[]> {
      const res = await apiClient.post<ApiEnvelope<AIPrompt[]>>(
        `/api/prompt-research/${projectId}/discover`,
        {},
      );
      return res.data;
    },

    async list(
      projectId: string,
    ): Promise<{ data: AIPrompt[]; meta: { limit: number; plan: string } }> {
      const res = await apiClient.get<{
        data: AIPrompt[];
        meta: { limit: number; plan: string };
      }>(`/api/prompt-research/${projectId}`);
      return res;
    },

    async remove(projectId: string, promptId: string): Promise<void> {
      await apiClient.delete(`/api/prompt-research/${projectId}/${promptId}`);
    },

    async check(data: {
      projectId: string;
      promptId?: string;
      prompt?: string;
      providers?: string[];
      region?: string;
      language?: string;
    }): Promise<PromptCheckResult> {
      const res = await apiClient.post<ApiEnvelope<PromptCheckResult>>(
        `/api/prompt-research/${data.projectId}/check`,
        {
          promptId: data.promptId,
          prompt: data.prompt,
          providers: data.providers,
          region: data.region,
          language: data.language,
        },
      );
      return res.data;
    },
  };
}
