/**
 * Signed token exchange for first-party app connections.
 * Uses HMAC-SHA256 via Web Crypto API (CF Workers compatible).
 * Tokens expire after 5 minutes to prevent replay attacks.
 */

const TOKEN_EXPIRY_MS = 5 * 60 * 1000;

function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signPayload(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const data = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + TOKEN_EXPIRY_MS,
  };
  const encoded = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(data)),
  );
  const key = await getKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encoded),
  );
  const sig = base64UrlEncode(new Uint8Array(signature));
  return `${encoded}.${sig}`;
}

export async function verifyPayload<T = Record<string, unknown>>(
  token: string,
  secret: string,
): Promise<{ valid: true; payload: T } | { valid: false; error: string }> {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Malformed token" };
  }
  const [encoded, sig] = parts;

  const key = await getKey(secret);
  const signatureBytes = base64UrlDecode(sig);
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(encoded),
  );

  if (!isValid) {
    return { valid: false, error: "Invalid signature" };
  }

  const payload = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(encoded)),
  ) as T & { exp?: number };

  if (payload.exp && Date.now() > payload.exp) {
    return { valid: false, error: "Token expired" };
  }

  return { valid: true, payload };
}
