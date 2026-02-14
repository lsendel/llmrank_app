/**
 * AES-256-GCM encryption/decryption using Web Crypto API.
 * Compatible with Cloudflare Workers and Node.js.
 *
 * Ciphertext format: "base64(iv):base64(ciphertext+tag)"
 */

async function importKey(hexKey: string): Promise<CryptoKey> {
  const keyBytes = new Uint8Array(
    hexKey.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
  );
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encrypt(
  plaintext: string,
  keyHex: string,
): Promise<string> {
  const key = await importKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  const ivB64 = btoa(String.fromCharCode(...iv));
  const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));

  return `${ivB64}:${cipherB64}`;
}

export async function decrypt(
  encrypted: string,
  keyHex: string,
): Promise<string> {
  const key = await importKey(keyHex);
  const [ivB64, cipherB64] = encrypted.split(":");

  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const cipherBytes = Uint8Array.from(atob(cipherB64), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipherBytes,
  );

  return new TextDecoder().decode(decrypted);
}
