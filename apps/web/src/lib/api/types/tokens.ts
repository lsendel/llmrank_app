export interface ApiTokenInfo {
  id: string;
  name: string;
  prefix: string;
  type: string;
  scopes: string[];
  projectId: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface ApiTokenWithPlaintext extends ApiTokenInfo {
  plaintext: string;
}

export interface CreateTokenInput {
  name: string;
  type?: "api" | "mcp";
  projectId?: string;
  scopes?: string[];
}
