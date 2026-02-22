export interface OAuthClient {
  clientId: string;
  clientSecret?: string; // Optional for public clients (PKCE)
  redirectUris: string[];
  scopes: string[];
  name: string;
}

export interface AuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  scopes: string[];
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  expiresAt: number; // Unix timestamp
}

export interface AccessToken {
  token: string;
  userId: string;
  clientId: string;
  scopes: string[];
  expiresAt: number; // Unix timestamp (1 hour)
}

export interface RefreshToken {
  token: string;
  userId: string;
  clientId: string;
  scopes: string[];
  expiresAt: number; // Unix timestamp (30 days)
}

export const MCP_SCOPES = [
  "projects:read",
  "projects:write",
  "crawls:read",
  "crawls:write",
  "pages:read",
  "scores:read",
  "issues:read",
  "visibility:read",
  "visibility:write",
  "fixes:write",
  "strategy:read",
  "competitors:read",
  "keywords:write",
  "queries:write",
  "reports:write",
  "content:read",
  "technical:read",
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];
