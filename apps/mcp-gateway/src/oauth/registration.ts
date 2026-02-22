import { Context } from "hono";
import { generateToken } from "./crypto";
import { OAuthStorage } from "./storage";

/**
 * Dynamic Client Registration (RFC 7591).
 *
 * ChatGPT and other MCP clients register themselves to obtain a client_id.
 * We accept all registrations (open policy) and store the client in KV.
 */
export async function handleRegister(
  c: Context,
  storage: OAuthStorage,
): Promise<Response> {
  const body = await c.req.json<{
    client_name?: string;
    redirect_uris?: string[];
    grant_types?: string[];
    response_types?: string[];
    token_endpoint_auth_method?: string;
    scope?: string;
  }>();

  const clientId = `client_${generateToken(16)}`;

  // Validate redirect_uris if provided
  const redirectUris = body.redirect_uris ?? [];
  for (const uri of redirectUris) {
    try {
      const parsed = new URL(uri);
      if (
        parsed.protocol !== "https:" &&
        parsed.hostname !== "localhost" &&
        parsed.hostname !== "127.0.0.1"
      ) {
        return c.json(
          {
            error: "invalid_redirect_uri",
            error_description: "Redirect URIs must use HTTPS or localhost",
          },
          400,
        );
      }
    } catch {
      return c.json(
        {
          error: "invalid_redirect_uri",
          error_description: `Invalid URI: ${uri}`,
        },
        400,
      );
    }
  }

  const client = {
    client_id: clientId,
    client_name: body.client_name ?? "MCP Client",
    redirect_uris: redirectUris,
    grant_types: body.grant_types ?? ["authorization_code", "refresh_token"],
    response_types: body.response_types ?? ["code"],
    token_endpoint_auth_method: body.token_endpoint_auth_method ?? "none",
    scope: body.scope,
    client_id_issued_at: Math.floor(Date.now() / 1000),
  };

  // Store client registration in KV (no expiry — persists until deleted)
  await storage.storeClient(clientId, client);

  return c.json(client, 201);
}
