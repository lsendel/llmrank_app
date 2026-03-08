import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type {
  ApiTokenInfo,
  ApiTokenWithPlaintext,
  CreateTokenInput,
} from "../types/tokens";

export function createTokensApi() {
  return {
    async list(): Promise<ApiTokenInfo[]> {
      const res =
        await apiClient.get<ApiEnvelope<ApiTokenInfo[]>>("/api/tokens");
      return res.data;
    },

    async create(data: CreateTokenInput): Promise<ApiTokenWithPlaintext> {
      const res = await apiClient.post<ApiEnvelope<ApiTokenWithPlaintext>>(
        "/api/tokens",
        data,
      );
      return res.data;
    },

    async revoke(id: string): Promise<void> {
      await apiClient.delete(`/api/tokens/${id}`);
    },
  };
}
