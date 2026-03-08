import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type {
  IntegrationInsights,
  ProjectIntegration,
} from "../types/integrations";

type OAuthUrlResponse = { url: string };

type IntegrationSyncResponse = {
  synced: boolean;
  enrichmentCount: number;
  crawlId: string;
  providers?: {
    provider: string;
    ok: boolean;
    count: number;
    error?: string;
  }[];
};

type IntegrationTestResponse = {
  ok: boolean;
  message: string;
};

export function createIntegrationsApi() {
  return {
    async list(projectId: string): Promise<ProjectIntegration[]> {
      const res = await apiClient.get<ApiEnvelope<ProjectIntegration[]>>(
        `/api/integrations/${projectId}`,
      );
      return res.data;
    },

    async connect(
      projectId: string,
      data: {
        provider: string;
        apiKey?: string;
        clarityProjectId?: string;
      },
    ): Promise<ProjectIntegration> {
      const res = await apiClient.post<ApiEnvelope<ProjectIntegration>>(
        `/api/integrations/${projectId}/connect`,
        data,
      );
      return res.data;
    },

    async update(
      projectId: string,
      integrationId: string,
      data: { enabled?: boolean; config?: Record<string, unknown> },
    ): Promise<ProjectIntegration> {
      const res = await apiClient.put<ApiEnvelope<ProjectIntegration>>(
        `/api/integrations/${projectId}/${integrationId}`,
        data,
      );
      return res.data;
    },

    async disconnect(projectId: string, integrationId: string): Promise<void> {
      await apiClient.delete(`/api/integrations/${projectId}/${integrationId}`);
    },

    async insights(
      projectId: string,
      crawlId?: string,
    ): Promise<IntegrationInsights> {
      const query = crawlId ? `?crawlId=${encodeURIComponent(crawlId)}` : "";
      const res = await apiClient.get<ApiEnvelope<IntegrationInsights>>(
        `/api/integrations/${projectId}/insights${query}`,
      );
      return res.data;
    },

    async startGoogleOAuth(
      projectId: string,
      provider: "gsc" | "ga4",
    ): Promise<OAuthUrlResponse> {
      const res = await apiClient.post<ApiEnvelope<OAuthUrlResponse>>(
        `/api/integrations/${projectId}/oauth/google/start`,
        { provider },
      );
      return res.data;
    },

    async oauthCallback(data: {
      code: string;
      state: string;
      redirectUri: string;
    }): Promise<ProjectIntegration> {
      const res = await apiClient.post<ApiEnvelope<ProjectIntegration>>(
        `/api/integrations/oauth/google/callback`,
        data,
      );
      return res.data;
    },

    async startMetaOAuth(
      projectId: string,
      adAccountId?: string,
    ): Promise<OAuthUrlResponse> {
      const res = await apiClient.post<ApiEnvelope<OAuthUrlResponse>>(
        `/api/integrations/${projectId}/oauth/meta/start`,
        { adAccountId },
      );
      return res.data;
    },

    async metaOAuthCallback(data: {
      code: string;
      state: string;
      redirectUri: string;
    }): Promise<ProjectIntegration> {
      const res = await apiClient.post<ApiEnvelope<ProjectIntegration>>(
        `/api/integrations/oauth/meta/callback`,
        data,
      );
      return res.data;
    },

    async sync(projectId: string): Promise<IntegrationSyncResponse> {
      const res = await apiClient.post<ApiEnvelope<IntegrationSyncResponse>>(
        `/api/integrations/${projectId}/sync`,
      );
      return res.data;
    },

    async test(
      projectId: string,
      integrationId: string,
    ): Promise<IntegrationTestResponse> {
      const res = await apiClient.post<ApiEnvelope<IntegrationTestResponse>>(
        `/api/integrations/${projectId}/${integrationId}/test`,
      );
      return res.data;
    },
  };
}
