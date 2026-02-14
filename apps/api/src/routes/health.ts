import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { AppEnv } from "../index";

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get("/", (c) => {
  return c.json({ status: "ok" });
});

// Temporary diagnostic: test JWKS connectivity (no secrets exposed)
healthRoutes.get("/auth-check", async (c) => {
  const hasSecret = !!c.env.CLERK_SECRET_KEY;
  const secretPrefix = hasSecret
    ? c.env.CLERK_SECRET_KEY.slice(0, 8) + "..."
    : "NOT SET";

  let jwksStatus: string;
  let jwksKeyCount = 0;
  try {
    const res = await fetch("https://api.clerk.com/v1/jwks", {
      headers: { Authorization: `Bearer ${c.env.CLERK_SECRET_KEY}` },
    });
    jwksStatus = `${res.status} ${res.statusText}`;
    if (res.ok) {
      const data: { keys: unknown[] } = await res.json();
      jwksKeyCount = data.keys.length;
    }
  } catch (e) {
    jwksStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  let dbStatus: string;
  try {
    const db = c.get("db");
    await db.execute(sql`SELECT 1` as any);
    dbStatus = "connected";
  } catch (e) {
    dbStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return c.json({
    clerkSecretKeyPrefix: secretPrefix,
    jwksStatus,
    jwksKeyCount,
    dbStatus,
  });
});

// Temporary diagnostic: test a specific JWT token
healthRoutes.post("/debug-token", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "No Bearer token provided" }, 400);
  }

  const token = authHeader.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) {
    return c.json(
      { error: "Invalid JWT format", partsCount: parts.length },
      400,
    );
  }

  // Decode without verification
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    const decodeB64 = (s: string) => {
      const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      return JSON.parse(atob(padded));
    };
    header = decodeB64(parts[0]);
    payload = decodeB64(parts[1]);
  } catch (e) {
    return c.json(
      { error: "Failed to decode JWT parts", detail: String(e) },
      400,
    );
  }

  // Check claims
  const now = Math.floor(Date.now() / 1000);
  const expOk = !payload.exp || (payload.exp as number) >= now;
  const nbfOk = !payload.nbf || (payload.nbf as number) <= now;

  // Try JWKS verification
  let verifyResult: string;
  try {
    const res = await fetch("https://api.clerk.com/v1/jwks", {
      headers: { Authorization: `Bearer ${c.env.CLERK_SECRET_KEY}` },
    });
    if (!res.ok) {
      verifyResult = `JWKS fetch failed: ${res.status}`;
    } else {
      const jwks: {
        keys: Array<{
          kid: string;
          kty: string;
          n: string;
          e: string;
          use: string;
        }>;
      } = await res.json();
      const matchingKey = jwks.keys.find((k) => k.kid === header.kid);
      if (!matchingKey) {
        verifyResult = `No key found for kid: ${header.kid}. Available kids: ${jwks.keys.map((k) => k.kid).join(", ")}`;
      } else {
        const cryptoKey = await crypto.subtle.importKey(
          "jwk",
          matchingKey,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          false,
          ["verify"],
        );
        const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
        const sigB64 = parts[2].replace(/-/g, "+").replace(/_/g, "/");
        const sigPadded = sigB64 + "=".repeat((4 - (sigB64.length % 4)) % 4);
        const sigBinary = atob(sigPadded);
        const sigBytes = new Uint8Array(sigBinary.length);
        for (let i = 0; i < sigBinary.length; i++)
          sigBytes[i] = sigBinary.charCodeAt(i);
        const valid = await crypto.subtle.verify(
          "RSASSA-PKCS1-v1_5",
          cryptoKey,
          sigBytes,
          data,
        );
        verifyResult = valid ? "VALID" : "INVALID signature";
      }
    }
  } catch (e) {
    verifyResult = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return c.json({
    header,
    payload: {
      sub: payload.sub,
      iss: payload.iss,
      exp: payload.exp,
      iat: payload.iat,
      nbf: payload.nbf,
      hasEmail: "email" in payload,
      hasFirstName: "first_name" in payload,
    },
    timeCheck: {
      serverNow: now,
      expOk,
      nbfOk,
      expiresIn: payload.exp ? (payload.exp as number) - now : null,
    },
    verifyResult,
  });
});
