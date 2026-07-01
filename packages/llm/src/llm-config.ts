/**
 * Centralized model selection for all LLM operations.
 * Change defaults here instead of hunting through individual files.
 */
export const LLM_MODELS = {
  scoring: "claude-haiku-4-5-20251001",
  summary: "claude-haiku-4-5-20251001",
  factExtraction: "claude-haiku-4-5-20251001",
  sentiment: "claude-haiku-4-5-20251001",
  personas: "claude-sonnet-4-6",
  optimizer: "claude-sonnet-4-6",
  visibility: {
    claude: "claude-sonnet-4-6",
    chatgpt: "gpt-4o-mini",
    gemini: "gemini-2.5-flash",
    gemini_ai_mode: "gemini-2.5-flash",
  },
} as const;

/**
 * Per-million-token prices (USD) for cost tracking. STANDARD (non-batch) rates;
 * pass `batch: true` to estimateCostUsd for the 50%-off Message Batches price.
 * Keep in sync with provider pricing pages. Unknown models fall back to a
 * conservative Sonnet-class rate so cost is never silently under-counted.
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> =
  {
    "claude-sonnet-5": { input: 2, output: 10 },
    "claude-sonnet-4-6": { input: 3, output: 15 },
    "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
    "claude-haiku-4-5": { input: 0.8, output: 4 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gemini-2.5-flash": { input: 0.075, output: 0.3 },
    // Cloudflare Workers AI (free-tier scorer) — negligible; tracked at ~$0.
    "@cf/openai/gpt-oss-120b": { input: 0, output: 0 },
  };

const _FALLBACK_PRICE = { input: 3, output: 15 };

/** Estimate USD cost of one call from token usage. `batch` applies the 50% discount. */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  opts: { batch?: boolean } = {},
): number {
  const p = MODEL_PRICING[model] ?? _FALLBACK_PRICE;
  const raw = (inputTokens / 1e6) * p.input + (outputTokens / 1e6) * p.output;
  return opts.batch ? raw * 0.5 : raw;
}
