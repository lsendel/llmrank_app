import Anthropic from "@anthropic-ai/sdk";
import type { LLMContentScores } from "@llm-boost/shared";
import { buildContentScoringPrompt } from "./prompts";
import { getCachedScore, setCachedScore } from "./cache";
import type { KVNamespace } from "./cache";

export interface LLMScorerOptions {
  anthropicApiKey: string;
  kvNamespace?: KVNamespace;
  model?: string;
}

const MIN_WORD_COUNT = 200;

export class LLMScorer {
  private client: Anthropic;
  private kv?: KVNamespace;
  private model: string;

  constructor(options: LLMScorerOptions) {
    this.client = new Anthropic({ apiKey: options.anthropicApiKey });
    this.kv = options.kvNamespace;
    this.model = options.model ?? "claude-haiku-4-5-20251001";
  }

  /**
   * Scores page content using an LLM, with optional KV caching.
   *
   * Returns null if the content is too thin (< 200 words).
   * Checks KV cache before making an API call.
   * Caches results for 30 days.
   */
  async scoreContent(
    pageText: string,
    contentHash: string,
  ): Promise<LLMContentScores | null> {
    // Check cache first
    if (this.kv) {
      const cached = await getCachedScore(this.kv, contentHash);
      if (cached) return cached;
    }

    // Skip thin content
    const wordCount = pageText.split(/\s+/).filter(Boolean).length;
    if (wordCount < MIN_WORD_COUNT) return null;

    const prompt = buildContentScoringPrompt(pageText);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const scores = JSON.parse(text) as LLMContentScores;

    // Cache result
    if (this.kv) {
      await setCachedScore(this.kv, contentHash, scores);
    }

    return scores;
  }
}
