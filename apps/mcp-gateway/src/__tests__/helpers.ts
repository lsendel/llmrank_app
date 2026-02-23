/// <reference types="@cloudflare/workers-types" />

/** In-memory KV shim — the only "mock" in the suite */
export function createMemoryKV(): KVNamespace {
  const store = new Map<string, { value: string; expiry?: number }>();

  return {
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiry && entry.expiry < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(key: string, value: string, opts?: { expirationTtl?: number }) {
      const expiry = opts?.expirationTtl
        ? Date.now() + opts.expirationTtl * 1000
        : undefined;
      store.set(key, { value, expiry });
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return {
        keys: [...store.keys()].map((name) => ({ name })),
        list_complete: true,
        cursor: "",
      };
    },
  } as unknown as KVNamespace;
}

/** Generate a valid PKCE challenge pair */
export async function generatePkce() {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"; // 43-char base64url
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(verifier),
  );
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return { verifier, challenge };
}
