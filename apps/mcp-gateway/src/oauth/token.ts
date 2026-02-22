import { Context } from "hono";
import { OAuthStorage } from "./storage";
import { generateToken, verifyPkceChallenge } from "./crypto";

/**
 * OAuth 2.1 Token endpoint.
 * Supports grant_type=authorization_code (with PKCE) and grant_type=refresh_token.
 */
export async function handleToken(
  c: Context,
  storage: OAuthStorage,
): Promise<Response> {
  const body = await c.req.parseBody();
  const grantType = body.grant_type as string;

  if (grantType === "authorization_code") {
    return handleAuthorizationCodeGrant(c, storage, body);
  }

  if (grantType === "refresh_token") {
    return handleRefreshTokenGrant(c, storage, body);
  }

  return c.json(
    {
      error: "unsupported_grant_type",
      error_description: "Supported: authorization_code, refresh_token",
    },
    400,
  );
}

async function handleAuthorizationCodeGrant(
  c: Context,
  storage: OAuthStorage,
  body: Record<string, string | File>,
): Promise<Response> {
  const code = body.code as string;
  const codeVerifier = body.code_verifier as string;
  const redirectUri = body.redirect_uri as string;

  if (!code || !codeVerifier || !redirectUri) {
    return c.json(
      {
        error: "invalid_request",
        error_description: "code, code_verifier, and redirect_uri are required",
      },
      400,
    );
  }

  // Look up authorization code
  const authCode = await storage.getAuthCode(code);
  if (!authCode) {
    return c.json(
      {
        error: "invalid_grant",
        error_description: "Invalid or expired authorization code",
      },
      400,
    );
  }

  // Delete code immediately (single-use)
  await storage.deleteAuthCode(code);

  // Verify redirect_uri matches
  if (authCode.redirectUri !== redirectUri) {
    return c.json(
      { error: "invalid_grant", error_description: "redirect_uri mismatch" },
      400,
    );
  }

  // Verify PKCE challenge
  const pkceValid = await verifyPkceChallenge(
    codeVerifier,
    authCode.codeChallenge,
  );
  if (!pkceValid) {
    return c.json(
      { error: "invalid_grant", error_description: "PKCE verification failed" },
      400,
    );
  }

  // Issue tokens
  return issueTokens(
    c,
    storage,
    authCode.userId,
    authCode.clientId,
    authCode.scopes,
  );
}

async function handleRefreshTokenGrant(
  c: Context,
  storage: OAuthStorage,
  body: Record<string, string | File>,
): Promise<Response> {
  const refreshTokenStr = body.refresh_token as string;
  if (!refreshTokenStr) {
    return c.json(
      {
        error: "invalid_request",
        error_description: "refresh_token is required",
      },
      400,
    );
  }

  const refreshToken = await storage.getRefreshToken(refreshTokenStr);
  if (!refreshToken) {
    return c.json(
      {
        error: "invalid_grant",
        error_description: "Invalid or expired refresh token",
      },
      400,
    );
  }

  // Rotate refresh token (delete old one)
  await storage.deleteRefreshToken(refreshTokenStr);

  return issueTokens(
    c,
    storage,
    refreshToken.userId,
    refreshToken.clientId,
    refreshToken.scopes,
  );
}

async function issueTokens(
  c: Context,
  storage: OAuthStorage,
  userId: string,
  clientId: string,
  scopes: string[],
): Promise<Response> {
  const accessTokenStr = generateToken(32);
  const refreshTokenStr = generateToken(32);
  const now = Math.floor(Date.now() / 1000);

  const accessToken = {
    token: accessTokenStr,
    userId,
    clientId,
    scopes,
    expiresAt: now + 3600, // 1 hour
  };

  const refreshToken = {
    token: refreshTokenStr,
    userId,
    clientId,
    scopes,
    expiresAt: now + 2592000, // 30 days
  };

  await Promise.all([
    storage.storeAccessToken(accessToken),
    storage.storeRefreshToken(refreshToken),
  ]);

  return c.json({
    access_token: accessTokenStr,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: refreshTokenStr,
    scope: scopes.join(" "),
  });
}
