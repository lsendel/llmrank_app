import { Context } from "hono";
import { MCP_SCOPES, McpScope } from "./types";
import { OAuthStorage } from "./storage";
import { generateToken } from "./crypto";
import { renderConsentPage } from "./consent-page";

interface OAuthParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
}

/** Validate OAuth params shared by GET and POST */
function validateParams(params: OAuthParams): string | null {
  if (params.response_type !== "code") {
    return "Only response_type=code is supported";
  }
  if (!params.client_id) return "client_id is required";
  if (!params.redirect_uri) return "redirect_uri is required";
  if (!params.code_challenge || params.code_challenge_method !== "S256") {
    return "PKCE with S256 is required";
  }

  const scopes = params.scope ? params.scope.split(" ").filter(Boolean) : [];
  const invalid = scopes.filter((s) => !MCP_SCOPES.includes(s as McpScope));
  if (invalid.length > 0) return `Invalid scopes: ${invalid.join(", ")}`;

  return null;
}

function extractOAuthParams(
  get: (key: string) => string | undefined,
): OAuthParams {
  return {
    response_type: get("response_type") ?? "",
    client_id: get("client_id") ?? "",
    redirect_uri: get("redirect_uri") ?? "",
    scope: get("scope") ?? MCP_SCOPES.join(" "),
    state: get("state") ?? "",
    code_challenge: get("code_challenge") ?? "",
    code_challenge_method: get("code_challenge_method") ?? "",
  };
}

/**
 * GET /oauth/authorize — render the login + consent page.
 */
export async function handleAuthorizeGet(c: Context): Promise<Response> {
  const params = extractOAuthParams((k) => c.req.query(k));
  const error = validateParams(params);

  if (error) {
    return c.json({ error: "invalid_request", error_description: error }, 400);
  }

  const html = renderConsentPage({
    clientId: params.client_id,
    redirectUri: params.redirect_uri,
    scope: params.scope,
    state: params.state,
    codeChallenge: params.code_challenge,
    codeChallengeMethod: params.code_challenge_method,
  });

  return c.html(html);
}

/**
 * POST /oauth/authorize — authenticate user, create MCP token, redirect.
 *
 * The form includes hidden OAuth fields + email/password.
 * Flow:
 *   1. Validate OAuth params
 *   2. Sign in via Better Auth (api.llmrank.app)
 *   3. Create an MCP API token for the user
 *   4. Generate auth code, store in KV
 *   5. Redirect to client with auth code
 */
export async function handleAuthorizePost(
  c: Context,
  storage: OAuthStorage,
  apiBaseUrl: string,
): Promise<Response> {
  const body = await c.req.parseBody();

  const params = extractOAuthParams((k) => String(body[k] ?? ""));
  const email = String(body.email ?? "");
  const password = String(body.password ?? "");

  // Re-validate OAuth params
  const paramError = validateParams(params);
  if (paramError) {
    return c.json(
      { error: "invalid_request", error_description: paramError },
      400,
    );
  }

  if (!email || !password) {
    return c.html(
      renderConsentPage({
        ...params,
        clientId: params.client_id,
        redirectUri: params.redirect_uri,
        codeChallenge: params.code_challenge,
        codeChallengeMethod: params.code_challenge_method,
        error: "Email and password are required.",
        email,
      }),
      400,
    );
  }

  // Step 1: Authenticate via Better Auth
  const signInRes = await fetch(`${apiBaseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!signInRes.ok) {
    // Always show a generic message — don't leak whether the email exists.
    await signInRes.text().catch(() => {}); // drain body

    return c.html(
      renderConsentPage({
        ...params,
        clientId: params.client_id,
        redirectUri: params.redirect_uri,
        codeChallenge: params.code_challenge,
        codeChallengeMethod: params.code_challenge_method,
        error: "Invalid email or password.",
        email,
      }),
      401,
    );
  }

  // Better Auth returns session token in both cookies and JSON body.
  // Read JSON body first (can only read once).
  const signInData = (await signInRes.json().catch(() => null)) as {
    token?: string;
    session?: { token?: string };
  } | null;

  // Try cookie first, then JSON body token
  const setCookies: string[] = (
    signInRes.headers as { getSetCookie?: () => string[] }
  ).getSetCookie?.() ?? [signInRes.headers.get("set-cookie") ?? ""];
  const sessionCookie = setCookies
    .filter(Boolean)
    .find((c: string) => c.startsWith("better-auth.session_token="));

  if (sessionCookie) {
    const cookieValue = sessionCookie.split(";")[0];
    return completeAuthorization(c, storage, apiBaseUrl, params, email, {
      Cookie: cookieValue,
    });
  }

  // Fall back to Bearer token from JSON body
  const bearerToken = signInData?.token ?? signInData?.session?.token;
  if (bearerToken) {
    return completeAuthorization(c, storage, apiBaseUrl, params, email, {
      Authorization: `Bearer ${bearerToken}`,
    });
  }

  return c.html(
    renderConsentPage({
      ...params,
      clientId: params.client_id,
      redirectUri: params.redirect_uri,
      codeChallenge: params.code_challenge,
      codeChallengeMethod: params.code_challenge_method,
      error: "Authentication failed. Please try again.",
      email,
    }),
    500,
  );
}

/**
 * Create MCP token, generate auth code, redirect.
 */
async function completeAuthorization(
  c: Context,
  storage: OAuthStorage,
  apiBaseUrl: string,
  params: OAuthParams,
  email: string,
  authHeaders: Record<string, string>,
): Promise<Response> {
  // Step 2: Create an MCP API token via the API
  const tokenRes = await fetch(`${apiBaseUrl}/api/api-tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({
      name: `MCP OAuth (${params.client_id})`,
      type: "mcp",
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error("Token creation failed:", tokenRes.status, errText);
    return c.html(
      renderConsentPage({
        ...params,
        clientId: params.client_id,
        redirectUri: params.redirect_uri,
        codeChallenge: params.code_challenge,
        codeChallengeMethod: params.code_challenge_method,
        error: "Failed to create access token. Please try again.",
        email,
      }),
      500,
    );
  }

  const tokenData = (await tokenRes.json()) as {
    data: { plaintext: string; scopes: string[] };
  };
  const apiToken = tokenData.data.plaintext;

  // Step 3: Generate authorization code
  const requestedScopes = params.scope.split(" ").filter(Boolean);
  const code = generateToken(32);
  const authCode = {
    code,
    clientId: params.client_id,
    userId: apiToken, // Store the MCP token as userId — used by token exchange
    scopes: requestedScopes,
    redirectUri: params.redirect_uri,
    codeChallenge: params.code_challenge,
    codeChallengeMethod: "S256" as const,
    expiresAt: Math.floor(Date.now() / 1000) + 600,
  };

  await storage.storeAuthCode(authCode);

  // Step 4: Redirect to client with auth code
  const redirectUrl = new URL(params.redirect_uri);
  redirectUrl.searchParams.set("code", code);
  if (params.state) {
    redirectUrl.searchParams.set("state", params.state);
  }

  return c.redirect(redirectUrl.toString(), 302);
}
