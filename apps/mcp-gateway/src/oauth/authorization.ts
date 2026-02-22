import { Context } from "hono";
import { MCP_SCOPES, McpScope } from "./types";
import { OAuthStorage } from "./storage";
import { generateToken } from "./crypto";

interface AuthorizeParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  code_challenge: string;
  code_challenge_method: string;
}

/**
 * OAuth 2.1 Authorization endpoint.
 *
 * In production this would render a consent page and validate the user session.
 * For now, it validates the request parameters and issues an authorization code
 * if a valid LLM Boost API token is provided via the X-API-Token header
 * (simulating an authenticated user).
 */
export async function handleAuthorize(
  c: Context,
  storage: OAuthStorage,
): Promise<Response> {
  const params: AuthorizeParams = {
    response_type: c.req.query("response_type") ?? "",
    client_id: c.req.query("client_id") ?? "",
    redirect_uri: c.req.query("redirect_uri") ?? "",
    scope: c.req.query("scope"),
    state: c.req.query("state"),
    code_challenge: c.req.query("code_challenge") ?? "",
    code_challenge_method: c.req.query("code_challenge_method") ?? "",
  };

  // Validate required params
  if (params.response_type !== "code") {
    return c.json(
      {
        error: "unsupported_response_type",
        error_description: "Only 'code' is supported",
      },
      400,
    );
  }

  if (!params.client_id) {
    return c.json(
      { error: "invalid_request", error_description: "client_id is required" },
      400,
    );
  }

  if (!params.redirect_uri) {
    return c.json(
      {
        error: "invalid_request",
        error_description: "redirect_uri is required",
      },
      400,
    );
  }

  if (!params.code_challenge || params.code_challenge_method !== "S256") {
    return c.json(
      {
        error: "invalid_request",
        error_description:
          "PKCE with S256 is required (code_challenge + code_challenge_method=S256)",
      },
      400,
    );
  }

  // Validate scopes
  const requestedScopes = params.scope
    ? params.scope.split(" ").filter(Boolean)
    : [...MCP_SCOPES];

  const invalidScopes = requestedScopes.filter(
    (s) => !MCP_SCOPES.includes(s as McpScope),
  );
  if (invalidScopes.length > 0) {
    return c.json(
      {
        error: "invalid_scope",
        error_description: `Invalid scopes: ${invalidScopes.join(", ")}`,
      },
      400,
    );
  }

  // In production: validate user session / show consent screen.
  // For MVP: require X-API-Token header to identify the user.
  const apiToken = c.req.header("X-API-Token");
  if (!apiToken) {
    return c.json(
      {
        error: "access_denied",
        error_description:
          "Authentication required. Provide X-API-Token header.",
      },
      401,
    );
  }

  // Generate authorization code
  const code = generateToken(32);
  const authCode = {
    code,
    clientId: params.client_id,
    userId: apiToken, // In production, resolve to actual user ID
    scopes: requestedScopes,
    redirectUri: params.redirect_uri,
    codeChallenge: params.code_challenge,
    codeChallengeMethod: "S256" as const,
    expiresAt: Math.floor(Date.now() / 1000) + 600, // 10 minutes
  };

  await storage.storeAuthCode(authCode);

  // Redirect with authorization code
  const redirectUrl = new URL(params.redirect_uri);
  redirectUrl.searchParams.set("code", code);
  if (params.state) {
    redirectUrl.searchParams.set("state", params.state);
  }

  return c.redirect(redirectUrl.toString(), 302);
}
