import { Hono } from "hono";
import { cors } from "hono/cors";
import { createOAuthStorage } from "./oauth/storage";
import { handleAuthorize } from "./oauth/authorization";
import { handleToken } from "./oauth/token";
import { oauthMiddleware } from "./oauth/middleware";
import { handleMcpRequest } from "./mcp-handler";

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

// Well-known OAuth metadata (RFC 8414)
app.get("/.well-known/oauth-authorization-server", (c) => {
  const baseUrl = new URL(c.req.url).origin;
  return c.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
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

// OAuth 2.1 endpoints
app.get("/oauth/authorize", async (c) => {
  const storage = createOAuthStorage(c.env.KV);
  return handleAuthorize(c, storage);
});

app.post("/oauth/token", async (c) => {
  const storage = createOAuthStorage(c.env.KV);
  return handleToken(c, storage);
});

// MCP Streamable HTTP endpoint (protected by OAuth)
const mcpRoute = new Hono<{ Bindings: Bindings }>();

mcpRoute.use("*", async (c, next) => {
  const storage = createOAuthStorage(c.env.KV);
  return oauthMiddleware(storage)(c, next);
});

mcpRoute.all("/", async (c) => {
  const token = c.get("oauthToken");
  return handleMcpRequest(c, token, c.env.API_BASE_URL);
});

app.route("/v1/mcp", mcpRoute);

export default app;
