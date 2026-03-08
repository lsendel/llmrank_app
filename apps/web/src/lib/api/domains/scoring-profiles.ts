import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type { ScoringProfile } from "../types/scoring-profiles";

type ScoringProfileInput = {
  name: string;
  weights: ScoringProfile["weights"];
};

type ScoringProfileUpdate = Partial<ScoringProfileInput>;

export function createScoringProfilesApi() {
  return {
    async list(): Promise<ScoringProfile[]> {
      const res = await apiClient.get<ApiEnvelope<ScoringProfile[]>>(
        "/api/scoring-profiles",
      );
      return res.data;
    },

    async create(data: ScoringProfileInput): Promise<ScoringProfile> {
      const res = await apiClient.post<ApiEnvelope<ScoringProfile>>(
        "/api/scoring-profiles",
        data,
      );
      return res.data;
    },

    async update(
      id: string,
      data: ScoringProfileUpdate,
    ): Promise<ScoringProfile> {
      const res = await apiClient.put<ApiEnvelope<ScoringProfile>>(
        `/api/scoring-profiles/${id}`,
        data,
      );
      return res.data;
    },

    async delete(id: string): Promise<void> {
      await apiClient.delete(`/api/scoring-profiles/${id}`);
    },
  };
}
