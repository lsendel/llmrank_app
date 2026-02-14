import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";
import { ERROR_CODES } from "@llm-boost/shared";
import { createLogger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JWK {
  kty: string;
  n: string;
  e: string;
  kid: string;
  alg: string;
  use: string;
}

interface JWKS {
  keys: JWK[];
}

interface JWTHeader {
  alg: string;
  typ: string;
  kid: string;
}

interface JWTPayload {
  sub: string;
  iss: string;
  exp: number;
  iat: number;
  nbf?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** In-memory JWKS cache to avoid fetching on every request. */
let jwksCache: { keys: Map<string, CryptoKey>; fetchedAt: number } | null =
  null;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJwtPart<T>(part: string): T {
  const decoded = new TextDecoder().decode(base64UrlDecode(part));
  return JSON.parse(decoded) as T;
}

async function fetchJWKS(
  clerkSecretKey: string,
): Promise<Map<string, CryptoKey>> {
  // Derive the Clerk frontend API domain from the secret key
  // Clerk secret keys are like sk_test_xxx or sk_live_xxx
  // We fetch from the Clerk Backend API JWKS endpoint instead
  const res = await fetch("https://api.clerk.com/v1/jwks", {
    headers: { Authorization: `Bearer ${clerkSecretKey}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS: ${res.status} ${res.statusText}`);
  }

  const jwks: JWKS = await res.json();
  const keys = new Map<string, CryptoKey>();

  for (const jwk of jwks.keys) {
    if (jwk.kty !== "RSA" || jwk.use !== "sig") continue;
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    keys.set(jwk.kid, cryptoKey);
  }

  return keys;
}

async function getSigningKey(
  clerkSecretKey: string,
  kid: string,
): Promise<CryptoKey> {
  const now = Date.now();
  if (!jwksCache || now - jwksCache.fetchedAt > JWKS_CACHE_TTL_MS) {
    const keys = await fetchJWKS(clerkSecretKey);
    jwksCache = { keys, fetchedAt: now };
  }

  const key = jwksCache.keys.get(kid);
  if (!key) {
    // Refetch in case keys rotated
    const keys = await fetchJWKS(clerkSecretKey);
    jwksCache = { keys, fetchedAt: now };
    const retryKey = jwksCache.keys.get(kid);
    if (!retryKey) {
      throw new Error(`No signing key found for kid: ${kid}`);
    }
    return retryKey;
  }

  return key;
}

async function verifyJWT(
  token: string,
  clerkSecretKey: string,
): Promise<JWTPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeJwtPart<JWTHeader>(headerB64);

  if (header.alg !== "RS256") {
    throw new Error(`Unsupported algorithm: ${header.alg}`);
  }

  const signingKey = await getSigningKey(clerkSecretKey, header.kid);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    signingKey,
    signature,
    data,
  );

  if (!valid) {
    throw new Error("Invalid JWT signature");
  }

  const payload = decodeJwtPart<JWTPayload>(payloadB64);
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error("JWT has expired");
  }

  if (payload.nbf && payload.nbf > now) {
    throw new Error("JWT is not yet valid");
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const err = ERROR_CODES.UNAUTHORIZED;
    return c.json(
      { error: { code: "UNAUTHORIZED", message: err.message } },
      err.status,
    );
  }

  const token = authHeader.slice(7);

  // Step 1: Verify JWT
  let payload: JWTPayload;
  try {
    payload = await verifyJWT(token, c.env.CLERK_SECRET_KEY);
  } catch (error) {
    const log =
      c.get("logger") ?? createLogger({ requestId: c.get("requestId") });
    log.warn("JWT verification failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    const err = ERROR_CODES.UNAUTHORIZED;
    return c.json(
      { error: { code: "UNAUTHORIZED", message: err.message } },
      err.status,
    );
  }

  // Step 2: Resolve Clerk user to DB user (auto-provision on first call)
  try {
    const db = c.get("db");
    const { userQueries } = await import("@llm-boost/db");
    let dbUser = await userQueries(db).getByClerkId(payload.sub);
    if (!dbUser) {
      const email = (payload.email as string) ?? `${payload.sub}@clerk.user`;
      const name = (payload.first_name as string) ?? undefined;
      dbUser = await userQueries(db).upsertFromClerk(payload.sub, email, name);
    }
    c.set("userId", dbUser.id);
    await next();
  } catch (error) {
    const log =
      c.get("logger") ?? createLogger({ requestId: c.get("requestId") });
    log.error("User provisioning failed", {
      clerkId: payload.sub,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to resolve user account",
        },
      },
      500,
    );
  }
});
