import { Hono } from "hono";
import { cors } from "hono/cors";
import { createOAuthStorage } from "./oauth/storage";
import { handleAuthorizeGet, handleAuthorizePost } from "./oauth/authorization";
import { handleToken } from "./oauth/token";
import { handleRegister } from "./oauth/registration";
import { oauthMiddleware } from "./oauth/middleware";
import { handleMcpRequest, type AuthenticatedUser } from "./mcp-handler";

type Bindings = {
  KV: KVNamespace;
  API_BASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "mcp-session-id",
      "Last-Event-ID",
      "mcp-protocol-version",
    ],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
  }),
);

// Health check
app.get("/health", (c) => c.json({ status: "ok", service: "mcp-gateway" }));

// ---------------------------------------------------------------------------
// OAuth Protected Resource Metadata (RFC 9728)
// ChatGPT uses this to discover the authorization server.
// ---------------------------------------------------------------------------
app.get("/.well-known/oauth-protected-resource", (c) => {
  const baseUrl = new URL(c.req.url).origin;
  return c.json({
    resource: `${baseUrl}/v1/mcp`,
    authorization_servers: [baseUrl],
    scopes_supported: [
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
    ],
    bearer_methods_supported: ["header"],
  });
});

// ---------------------------------------------------------------------------
// OAuth Authorization Server Metadata (RFC 8414)
// ---------------------------------------------------------------------------
app.get("/.well-known/oauth-authorization-server", (c) => {
  const baseUrl = new URL(c.req.url).origin;
  return c.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [
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
    ],
  });
});

// ---------------------------------------------------------------------------
// OAuth 2.1 endpoints
// ---------------------------------------------------------------------------
app.get("/oauth/authorize", async (c) => {
  const storage = createOAuthStorage(c.env.KV);
  return handleAuthorizeGet(c, storage);
});

app.post("/oauth/authorize", async (c) => {
  const storage = createOAuthStorage(c.env.KV);
  return handleAuthorizePost(c, storage, c.env.API_BASE_URL);
});

app.post("/oauth/token", async (c) => {
  const storage = createOAuthStorage(c.env.KV);
  return handleToken(c, storage);
});

// Dynamic Client Registration (RFC 7591)
app.post("/oauth/register", async (c) => {
  const storage = createOAuthStorage(c.env.KV);
  return handleRegister(c, storage);
});

// ---------------------------------------------------------------------------
// MCP Streamable HTTP endpoint
// Supports two auth methods:
//   1. OAuth Bearer token (from /oauth/token flow)
//   2. Direct API token (Bearer llmb_xxx) for dev/testing
// ---------------------------------------------------------------------------

const mcpRoute = new Hono<{ Bindings: Bindings }>();

mcpRoute.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const baseUrl = new URL(c.req.url).origin;

  if (!authHeader?.startsWith("Bearer ")) {
    // RFC 9728: Include WWW-Authenticate with resource_metadata URL
    c.header(
      "WWW-Authenticate",
      `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
    );
    return c.json(
      { error: "invalid_token", error_description: "Bearer token required" },
      401,
    );
  }

  const tokenStr = authHeader.slice(7);

  // Direct API token (llmb_ prefix) — bypass OAuth, use token directly
  if (tokenStr.startsWith("llmb_")) {
    const user: AuthenticatedUser = {
      apiToken: tokenStr,
      scopes: ["*"],
    };
    c.set("mcpUser", user);
    return next();
  }

  // Otherwise treat as OAuth access token
  const storage = createOAuthStorage(c.env.KV);
  return oauthMiddleware(storage)(c, next);
});

mcpRoute.all("/", async (c) => {
  const user = c.get("mcpUser") as AuthenticatedUser | undefined;

  if (!user) {
    // OAuth flow — resolve user from OAuth token
    const oauthToken = c.get("oauthToken");
    if (!oauthToken) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const oauthUser: AuthenticatedUser = {
      apiToken: oauthToken.userId, // userId stores the API token in current OAuth impl
      scopes: oauthToken.scopes,
    };
    return handleMcpRequest(c, oauthUser, c.env.API_BASE_URL);
  }

  return handleMcpRequest(c, user, c.env.API_BASE_URL);
});

app.route("/v1/mcp", mcpRoute);

export default app;
