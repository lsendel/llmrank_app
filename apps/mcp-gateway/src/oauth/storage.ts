import { AuthorizationCode, AccessToken, RefreshToken } from "./types";

export function createOAuthStorage(kv: KVNamespace) {
  return {
    async storeAuthCode(code: AuthorizationCode): Promise<void> {
      const ttl = Math.ceil(code.expiresAt - Date.now() / 1000);
      await kv.put(`oauth:code:${code.code}`, JSON.stringify(code), {
        expirationTtl: Math.max(ttl, 60),
      });
    },

    async getAuthCode(code: string): Promise<AuthorizationCode | null> {
      const data = await kv.get(`oauth:code:${code}`);
      if (!data) return null;
      const parsed = JSON.parse(data) as AuthorizationCode;
      if (parsed.expiresAt < Date.now() / 1000) return null;
      return parsed;
    },

    async deleteAuthCode(code: string): Promise<void> {
      await kv.delete(`oauth:code:${code}`);
    },

    async storeAccessToken(token: AccessToken): Promise<void> {
      await kv.put(`oauth:access:${token.token}`, JSON.stringify(token), {
        expirationTtl: 3600, // 1 hour
      });
    },

    async getAccessToken(token: string): Promise<AccessToken | null> {
      const data = await kv.get(`oauth:access:${token}`);
      if (!data) return null;
      return JSON.parse(data) as AccessToken;
    },

    async storeRefreshToken(token: RefreshToken): Promise<void> {
      await kv.put(`oauth:refresh:${token.token}`, JSON.stringify(token), {
        expirationTtl: 2592000, // 30 days
      });
    },

    async getRefreshToken(token: string): Promise<RefreshToken | null> {
      const data = await kv.get(`oauth:refresh:${token}`);
      if (!data) return null;
      return JSON.parse(data) as RefreshToken;
    },

    async deleteRefreshToken(token: string): Promise<void> {
      await kv.delete(`oauth:refresh:${token}`);
    },

    // Dynamic Client Registration (RFC 7591)
    async storeClient(
      clientId: string,
      client: Record<string, unknown>,
    ): Promise<void> {
      await kv.put(`oauth:client:${clientId}`, JSON.stringify(client));
    },

    async getClient(clientId: string): Promise<Record<string, unknown> | null> {
      const data = await kv.get(`oauth:client:${clientId}`);
      if (!data) return null;
      return JSON.parse(data) as Record<string, unknown>;
    },
  };
}

export type OAuthStorage = ReturnType<typeof createOAuthStorage>;
