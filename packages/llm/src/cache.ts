import type { LLMContentScores } from "@llm-boost/shared";

/** Minimal KVNamespace interface compatible with Cloudflare Workers KV. */
export interface KVNamespace {
  get(key: string, type: "json"): Promise<unknown>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

const CACHE_PREFIX = "llm-score:";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Retrieves a cached LLM content score from KV storage.
 * Returns null if no cached score exists.
 */
export async function getCachedScore(
  kv: KVNamespace,
  contentHash: string,
): Promise<LLMContentScores | null> {
  const cached = await kv.get(`${CACHE_PREFIX}${contentHash}`, "json");
  if (cached) return cached as LLMContentScores;
  return null;
}

/**
 * Stores an LLM content score in KV storage with a 30-day TTL.
 */
export async function setCachedScore(
  kv: KVNamespace,
  contentHash: string,
  scores: LLMContentScores,
): Promise<void> {
  await kv.put(`${CACHE_PREFIX}${contentHash}`, JSON.stringify(scores), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
}
