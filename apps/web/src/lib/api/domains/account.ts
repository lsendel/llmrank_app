import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type {
  AccountPreferences,
  DigestPreferences,
  NotificationPreferences,
} from "../types/account";

type AccountMe = {
  isAdmin: boolean;
  plan: string;
  email: string;
  onboardingComplete: boolean;
  persona: string | null;
  digestFrequency: string | null;
};

type PersonaClassification = {
  persona: string;
  confidence: "high" | "medium";
  reasoning: string;
};

export function createAccountApi() {
  return {
    async getMe(): Promise<AccountMe> {
      const res = await apiClient.get<ApiEnvelope<AccountMe>>("/api/account");
      return res.data;
    },

    async getPreferences(): Promise<AccountPreferences> {
      const res = await apiClient.get<ApiEnvelope<AccountPreferences>>(
        "/api/account/preferences",
      );
      return res.data;
    },

    async updatePreferences(
      data: Partial<AccountPreferences>,
    ): Promise<AccountPreferences> {
      const res = await apiClient.put<ApiEnvelope<AccountPreferences>>(
        "/api/account/preferences",
        data,
      );
      return res.data;
    },

    async updateProfile(data: {
      name?: string;
      phone?: string;
      onboardingComplete?: boolean;
      persona?: string;
      digestFrequency?: string;
    }): Promise<void> {
      await apiClient.put("/api/account", data);
    },

    async classifyPersona(data: {
      teamSize: string;
      primaryGoal: string;
      domain?: string;
    }): Promise<PersonaClassification> {
      const res = await apiClient.post<ApiEnvelope<PersonaClassification>>(
        "/api/account/classify-persona",
        data,
      );
      return res.data;
    },

    async deleteAccount(): Promise<void> {
      await apiClient.delete<void>("/api/account");
    },

    async getNotifications(): Promise<NotificationPreferences> {
      const res = await apiClient.get<ApiEnvelope<NotificationPreferences>>(
        "/api/account/notifications",
      );
      return res.data;
    },

    async updateNotifications(
      data: Partial<NotificationPreferences>,
    ): Promise<NotificationPreferences> {
      const res = await apiClient.put<ApiEnvelope<NotificationPreferences>>(
        "/api/account/notifications",
        data,
      );
      return res.data;
    },

    async getDigestPreferences(): Promise<DigestPreferences> {
      const res = await apiClient.get<ApiEnvelope<DigestPreferences>>(
        "/api/account/digest",
      );
      return res.data;
    },

    async updateDigestPreferences(
      data: Partial<DigestPreferences>,
    ): Promise<DigestPreferences> {
      const res = await apiClient.put<ApiEnvelope<DigestPreferences>>(
        "/api/account/digest",
        data,
      );
      return res.data;
    },
  };
}
