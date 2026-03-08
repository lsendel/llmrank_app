import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";

type NarrativeTone = "technical" | "business";

// Preserve the existing loose response surface for these endpoints.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NarrativeResponse = any;

type NarrativeDeleteResponse = { deleted: boolean };

export function createNarrativesApi() {
  return {
    async generate(
      crawlJobId: string,
      tone: NarrativeTone = "technical",
    ): Promise<NarrativeResponse> {
      const res = await apiClient.post<ApiEnvelope<NarrativeResponse>>(
        "/api/narratives/generate",
        { crawlJobId, tone },
      );
      return res.data;
    },

    async get(
      crawlJobId: string,
      tone: NarrativeTone = "technical",
    ): Promise<NarrativeResponse> {
      const res = await apiClient.get<ApiEnvelope<NarrativeResponse>>(
        `/api/narratives/${crawlJobId}?tone=${tone}`,
      );
      return res.data;
    },

    async editSection(
      crawlJobId: string,
      sectionId: string,
      editedContent: string | null,
    ): Promise<NarrativeResponse> {
      const res = await apiClient.patch<ApiEnvelope<NarrativeResponse>>(
        `/api/narratives/${crawlJobId}/sections/${sectionId}`,
        { editedContent },
      );
      return res.data;
    },

    async regenerateSection(
      crawlJobId: string,
      sectionType: string,
      instructions?: string,
    ): Promise<NarrativeResponse> {
      const res = await apiClient.post<ApiEnvelope<NarrativeResponse>>(
        `/api/narratives/${crawlJobId}/sections/${sectionType}/regenerate`,
        { instructions },
      );
      return res.data;
    },

    async delete(crawlJobId: string): Promise<NarrativeDeleteResponse> {
      const res = await apiClient.delete<ApiEnvelope<NarrativeDeleteResponse>>(
        `/api/narratives/${crawlJobId}`,
      );
      return res.data;
    },
  };
}
