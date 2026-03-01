/**
 * Canonical token scope definitions shared by both the API token system
 * and the MCP OAuth gateway.
 */

export const API_TOKEN_SCOPES = [
  "metrics:read",
  "scores:read",
  "visibility:read",
  "projects:read",
  "visibility:write",
  "crawls:write",
] as const;

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

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

/** Union of all valid token scopes (API + MCP). */
export const ALL_TOKEN_SCOPES = [
  ...API_TOKEN_SCOPES,
  ...MCP_SCOPES.filter((s) => !API_TOKEN_SCOPES.includes(s as ApiTokenScope)),
] as const;

export type TokenScope = ApiTokenScope | McpScope;
