import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";

type AlertSeverity = "critical" | "warning" | "info";

type Alert = {
  id: string;
  projectId: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  data: unknown;
  acknowledgedAt: string | null;
  createdAt: string;
};

type AcknowledgeAllResponse = { success: boolean };

export function createAlertsApi() {
  return {
    async list(projectId: string): Promise<Alert[]> {
      const res = await apiClient.get<ApiEnvelope<Alert[]>>(
        `/api/alerts?projectId=${projectId}`,
      );
      return res.data;
    },

    async acknowledge(id: string): Promise<unknown> {
      const res = await apiClient.post<ApiEnvelope<unknown>>(
        `/api/alerts/${id}/acknowledge`,
        {},
      );
      return res.data;
    },

    async acknowledgeAll(projectId: string): Promise<AcknowledgeAllResponse> {
      const res = await apiClient.post<ApiEnvelope<AcknowledgeAllResponse>>(
        `/api/alerts/acknowledge-all?projectId=${projectId}`,
        {},
      );
      return res.data;
    },
  };
}
