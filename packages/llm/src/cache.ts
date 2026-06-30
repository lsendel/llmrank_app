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
 * Cache key, namespaced by model. Different models (Workers AI gpt-oss, Haiku,
 * Sonnet) score the SAME content differently — and the Workers AI path caches
 * RAW un-calibrated scores — so a model-agnostic key would serve one model's
 * score for another's request (e.g. a paid Sonnet crawl getting a free-tier
 * gpt-oss score). Including the model keeps each model's cache separate.
 */
function cacheKey(contentHash: string, model?: string): string {
  return model
    ? `${CACHE_PREFIX}${model}:${contentHash}`
    : `${CACHE_PREFIX}${contentHash}`;
}

/**
 * Retrieves a cached LLM content score from KV storage for the given model.
 * Returns null if no cached score exists.
 */
export async function getCachedScore(
  kv: KVNamespace,
  contentHash: string,
  model?: string,
): Promise<LLMContentScores | null> {
  const cached = await kv.get(cacheKey(contentHash, model), "json");
  if (cached) return cached as LLMContentScores;
  return null;
}

/**
 * Stores an LLM content score in KV storage (per model) with a 30-day TTL.
 */
export async function setCachedScore(
  kv: KVNamespace,
  contentHash: string,
  scores: LLMContentScores,
  model?: string,
): Promise<void> {
  await kv.put(cacheKey(contentHash, model), JSON.stringify(scores), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
}
