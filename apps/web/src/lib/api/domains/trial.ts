import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";

type TrialStatus = {
  eligible: boolean;
  active: boolean;
  daysRemaining?: number;
};

type TrialStartResponse = {
  trialStartedAt: string;
  trialEndsAt: string;
  daysRemaining: number;
};

export function createTrialApi() {
  return {
    async status(): Promise<TrialStatus> {
      const res =
        await apiClient.get<ApiEnvelope<TrialStatus>>("/api/trial/status");
      return res.data;
    },

    async start(): Promise<TrialStartResponse> {
      const res = await apiClient.post<ApiEnvelope<TrialStartResponse>>(
        "/api/trial/start",
        {},
      );
      return res.data;
    },
  };
}
