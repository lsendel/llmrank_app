import Anthropic from "@anthropic-ai/sdk";
import type { LLMContentScores } from "@llm-boost/shared";
import { buildContentScoringPrompt } from "./prompts";
import { getCachedScore, setCachedScore } from "./cache";
import type { KVNamespace } from "./cache";
import { withRetry } from "./retry";
import { LLM_MODELS } from "./llm-config";

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
    this.model = options.model ?? LLM_MODELS.scoring;
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
    const response = await withRetry(() =>
      this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }],
      }),
    );

    let text =
      response.content[0].type === "text" ? response.content[0].text : "";
    // Strip markdown code fences if present (e.g. ```json ... ```)
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();
    const scores = JSON.parse(text) as LLMContentScores;

    // Cache result
    if (this.kv) {
      await setCachedScore(this.kv, contentHash, scores);
    }

    return scores;
  }
}
