// LLM Rank's own first-party surfaces — legitimately hardcoded (this is the
// product, not a tenant). Any OTHER cross-origin caller (a dogfood/partner site
// embedding the API) is configured via CORS_ALLOWED_ORIGINS, NOT baked into the
// trust logic — so the platform isn't wired to one brand's TLD.
export const APP_ORIGINS = [
  "http://localhost:3000",
  "https://llmrank.app",
  "https://www.llmrank.app",
  "https://llmboost.com",
  "https://www.llmboost.com",
];

/**
 * Decide whether an Origin may make credentialed cross-origin requests.
 * `configured` is CORS_ALLOWED_ORIGINS: a comma-separated list of exact origins
 * (`https://app.example.com`) and/or host suffixes (`.example.com`, which also
 * matches the apex `example.com`). Replaces the old `origin.endsWith(".care")`
 * brand wildcard with config the operator controls per environment.
 */
export function isAllowedOrigin(
  origin: string,
  configured: string | undefined,
): boolean {
  if (APP_ORIGINS.includes(origin)) return true;
  if (!configured) return false;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  for (const raw of configured.split(",")) {
    const entry = raw.trim();
    if (!entry) continue;
    if (entry.startsWith(".")) {
      // ".example.com" matches sub.example.com and the apex example.com
      if (host === entry.slice(1) || host.endsWith(entry)) return true;
    } else if (entry === origin) {
      return true;
    }
  }
  return false;
}
