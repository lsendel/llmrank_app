import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";
import { ERROR_CODES } from "@llm-boost/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_TIMESTAMP_DRIFT_S = 300; // 5 minutes

function hexEncode(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function computeHmac(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  return hexEncode(signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export const hmacMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const signatureHeader = c.req.header("X-Signature");
  const timestampHeader = c.req.header("X-Timestamp");

  if (!signatureHeader || !timestampHeader) {
    const err = ERROR_CODES.HMAC_INVALID;
    return c.json(
      {
        error: {
          code: "HMAC_INVALID",
          message: "Missing signature or timestamp headers",
        },
      },
      err.status,
    );
  }

  // Validate timestamp freshness
  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp)) {
    const err = ERROR_CODES.HMAC_INVALID;
    return c.json(
      { error: { code: "HMAC_INVALID", message: "Invalid timestamp" } },
      err.status,
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > MAX_TIMESTAMP_DRIFT_S) {
    const err = ERROR_CODES.HMAC_INVALID;
    return c.json(
      {
        error: {
          code: "HMAC_INVALID",
          message: "Timestamp too old or too far in the future",
        },
      },
      err.status,
    );
  }

  // Extract the hex signature from "hmac-sha256=<hex>"
  const prefix = "hmac-sha256=";
  if (!signatureHeader.startsWith(prefix)) {
    const err = ERROR_CODES.HMAC_INVALID;
    return c.json(
      { error: { code: "HMAC_INVALID", message: "Invalid signature format" } },
      err.status,
    );
  }
  const providedHex = signatureHeader.slice(prefix.length);

  // Read the raw body
  const body = await c.req.text();
  const message = `${timestampHeader}${body}`;
  const expectedHex = await computeHmac(c.env.SHARED_SECRET, message);

  if (!timingSafeEqual(providedHex, expectedHex)) {
    const err = ERROR_CODES.HMAC_INVALID;
    return c.json(
      { error: { code: "HMAC_INVALID", message: err.message } },
      err.status,
    );
  }

  // Store the parsed body so downstream handlers don't need to re-read
  c.set("parsedBody", body);
  await next();
});

// ---------------------------------------------------------------------------
// Signing utility (used when dispatching to crawler)
// ---------------------------------------------------------------------------

export async function signPayload(
  secret: string,
  body: string,
): Promise<{ signature: string; timestamp: string }> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${timestamp}${body}`;
  const hex = await computeHmac(secret, message);
  return {
    signature: `hmac-sha256=${hex}`,
    timestamp,
  };
}
