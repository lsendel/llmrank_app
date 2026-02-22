import { Context, Next } from "hono";
import { OAuthStorage } from "./storage";
import { AccessToken } from "./types";

declare module "hono" {
  interface ContextVariableMap {
    oauthToken: AccessToken;
  }
}

/**
 * Hono middleware that validates the Bearer token from the Authorization header
 * and sets the access token on the context for downstream handlers.
 */
export function oauthMiddleware(storage: OAuthStorage) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json(
        { error: "invalid_token", error_description: "Bearer token required" },
        401,
      );
    }

    const tokenStr = authHeader.slice(7);
    const token = await storage.getAccessToken(tokenStr);
    if (!token) {
      return c.json(
        {
          error: "invalid_token",
          error_description: "Invalid or expired access token",
        },
        401,
      );
    }

    if (token.expiresAt < Math.floor(Date.now() / 1000)) {
      return c.json(
        { error: "invalid_token", error_description: "Access token expired" },
        401,
      );
    }

    c.set("oauthToken", token);
    await next();
  };
}
