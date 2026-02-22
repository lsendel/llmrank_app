/** Generate a cryptographically random token string */
export function generateToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Verify PKCE S256 code challenge: SHA-256(code_verifier) === code_challenge */
export async function verifyPkceChallenge(
  codeVerifier: string,
  codeChallenge: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(codeVerifier),
  );
  const hashArray = new Uint8Array(digest);
  // Base64url encode (RFC 7636)
  const base64url = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return base64url === codeChallenge;
}
