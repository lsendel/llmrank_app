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

  /**
   * Builds batch request objects for the Anthropic Message Batches API.
   * Checks KV cache first; cached pages are returned separately and excluded
   * from the requests array. Pages with fewer than MIN_WORD_COUNT words are
   * also skipped (not added to requests).
   */
  async buildBatchRequests(
    pages: { pageId: string; text: string; contentHash: string }[],
  ): Promise<{
    cached: { pageId: string; scores: LLMContentScores }[];
    requests: {
      custom_id: string;
      params: {
        model: string;
        max_tokens: number;
        system: string;
        messages: { role: "user"; content: string }[];
      };
    }[];
  }> {
    const cached: { pageId: string; scores: LLMContentScores }[] = [];
    const requests: {
      custom_id: string;
      params: {
        model: string;
        max_tokens: number;
        system: string;
        messages: { role: "user"; content: string }[];
      };
    }[] = [];

    for (const page of pages) {
      // Check KV cache first
      if (this.kv) {
        const cachedScore = await getCachedScore(this.kv, page.contentHash);
        if (cachedScore) {
          cached.push({ pageId: page.pageId, scores: cachedScore });
          continue;
        }
      }

      // Skip thin content
      const wordCount = page.text.split(/\s+/).filter(Boolean).length;
      if (wordCount < MIN_WORD_COUNT) continue;

      const prompt = buildContentScoringPrompt(page.text);
      requests.push({
        custom_id: page.pageId,
        params: {
          model: this.model,
          max_tokens: 1024,
          system: prompt.system,
          messages: [{ role: "user", content: prompt.user }],
        },
      });
    }

    return { cached, requests };
  }

  /**
   * Parses a single batch result message into LLMContentScores.
   * Returns null if no text block is found or parsing fails.
   */
  processBatchResult(resultMessage: {
    content: { type: string; text?: string }[];
  }): LLMContentScores | null {
    const textBlock = resultMessage.content.find(
      (block) => block.type === "text",
    );
    if (!textBlock || !textBlock.text) return null;

    let text = textBlock.text;
    // Strip markdown code fences if present (e.g. ```json ... ```)
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();

    try {
      return JSON.parse(text) as LLMContentScores;
    } catch {
      return null;
    }
  }

  /**
   * Exposes the Anthropic client for batch submission code.
   */
  get anthropicClient(): Anthropic {
    return this.client;
  }
}
