import {
  LLMContentScoresSchema,
  type LLMContentScores,
} from "@llm-boost/shared";
import { buildContentScoringPrompt } from "./prompts";
import { getCachedScore, setCachedScore, type KVNamespace } from "./cache";

/**
 * Cloudflare Workers AI content scorer.
 *
 * Runs the same 5-dimension scoring rubric as the Anthropic {@link LLMScorer},
 * but against a model hosted on Workers AI (default `@cf/openai/gpt-oss-120b`).
 * Because Workers AI runs *inside* the Worker (synchronously, via the `AI`
 * binding) and is ~8x cheaper than batched Claude, this both fixes worker-context
 * LLM scoring (which previously never persisted — see RANK2) and avoids the
 * async Message-Batches/poller machinery entirely: score here, write D1 directly.
 */

/** Minimal shape of the Cloudflare `AI` binding — avoids a workers-types dep here. */
export interface WorkersAi {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

const MIN_WORD_COUNT = 200;

/** Default Workers AI model: OpenAI's 120B open reasoning model. Configurable. */
export const DEFAULT_WORKERS_AI_MODEL = "@cf/openai/gpt-oss-120b";

/** True for models that take the `instructions`+`input` request shape (gpt-oss / OpenAI). */
export function usesResponsesShape(model: string): boolean {
  return /gpt-oss|@cf\/openai\//i.test(model);
}

/**
 * Pull the assistant text out of a Workers AI `run()` response. The shape varies
 * by model (plain `{ response }`, OpenAI-compatible `{ choices }`, or the
 * gpt-oss "harmony" `{ output_text }`/output channels), so probe each.
 */
export function extractWorkersAiText(res: unknown): string | null {
  if (res == null) return null;
  if (typeof res === "string") return res;
  if (typeof res !== "object") return null;
  const r = res as Record<string, any>;

  if (typeof r.response === "string") return r.response;
  if (typeof r.output_text === "string") return r.output_text;
  if (typeof r.result?.response === "string") return r.result.response;

  // OpenAI-compatible chat completion shape
  const choiceContent = r.choices?.[0]?.message?.content;
  if (typeof choiceContent === "string") return choiceContent;

  // Responses/harmony: output is an array of items. Skip `reasoning` items and
  // `reasoning_text` blocks — only the final assistant `message` holds the
  // answer. Concatenating reasoning could let the parser span the reasoning's
  // stray braces plus the real JSON and reject an otherwise-valid score.
  if (Array.isArray(r.output)) {
    const parts: string[] = [];
    for (const item of r.output) {
      if (item?.type === "reasoning") continue;
      const content = item?.content;
      if (typeof content === "string") parts.push(content);
      else if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "reasoning_text") continue;
          if (typeof block?.text === "string") parts.push(block.text);
        }
      }
    }
    if (parts.length > 0) return parts.join("\n");
  }

  return null;
}

/**
 * Scan `text` for complete, balanced top-level `{...}` objects, respecting string
 * literals (so braces inside quoted strings don't break nesting). Returns them in
 * source order. Used to pull the real score object out of reasoning prose that
 * may itself contain stray braces — a plain first-`{`-to-last-`}` slice over-spans.
 */
export function extractJsonObjects(text: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}" && depth > 0) {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return objects;
}

/**
 * Parse + validate model output into {@link LLMContentScores}. Strips markdown
 * fences and tolerates surrounding prose / reasoning, then validates against the
 * zod schema — so a malformed or out-of-range response yields null (the page
 * keeps its deterministic scores) rather than corrupting the stored score.
 */
export function parseContentScores(text: string): LLMContentScores | null {
  const trimmed = text.trim();
  const candidates: string[] = [trimmed];

  const fence = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fence) candidates.push(fence[1].trim());

  // Each balanced top-level object, last first — the score object is normally the
  // final JSON in a reasoning-then-answer response.
  const objects = extractJsonObjects(trimmed);
  for (let i = objects.length - 1; i >= 0; i--) candidates.push(objects[i]);

  for (const candidate of candidates) {
    try {
      const parsed = LLMContentScoresSchema.safeParse(JSON.parse(candidate));
      if (parsed.success) return parsed.data;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export interface WorkersAiScorerOptions {
  ai: WorkersAi;
  kvNamespace?: KVNamespace;
  model?: string;
}

export class WorkersAiScorer {
  private ai: WorkersAi;
  private kv?: KVNamespace;
  private model: string;

  constructor(options: WorkersAiScorerOptions) {
    this.ai = options.ai;
    this.kv = options.kvNamespace;
    this.model = options.model ?? DEFAULT_WORKERS_AI_MODEL;
  }

  /**
   * Score page content. Returns null for thin content (< 200 words). THROWS when
   * non-thin content yields no usable scores (provider error / wrong request
   * shape / unparseable output) so the caller counts it as a failure rather than
   * a silent skip. Checks the content-hash KV cache first; caches success 30 days.
   */
  async scoreContent(
    pageText: string,
    contentHash: string,
  ): Promise<LLMContentScores | null> {
    if (this.kv) {
      const cached = await getCachedScore(this.kv, contentHash, this.model);
      if (cached) return cached;
    }

    const wordCount = pageText.split(/\s+/).filter(Boolean).length;
    if (wordCount < MIN_WORD_COUNT) return null;

    const prompt = buildContentScoringPrompt(pageText);
    // gpt-oss / OpenAI models take `instructions` + `input`; Llama/Qwen/etc. take
    // a `messages` array. Try the model-appropriate shape first, then the other —
    // this covers model swaps (the gpt-oss → Qwen3 A/B) and per-model schema
    // differences. The rubric prompt already demands JSON-only and
    // parseContentScores tolerates reasoning/prose, so no structured-output param
    // is sent (its field name differs across Workers AI model families).
    // gpt-oss / OpenAI use the Responses shape (`instructions`+`input`,
    // `max_output_tokens`); Llama/Qwen use the chat shape (`messages`,
    // `max_tokens`).
    const responsesInput = {
      instructions: prompt.system,
      input: prompt.user,
      max_output_tokens: 1024,
    };
    const chatInput = {
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      max_tokens: 1024,
    };
    const attempts = usesResponsesShape(this.model)
      ? [responsesInput, chatInput]
      : [chatInput, responsesInput];

    let lastError: unknown;
    for (const attempt of attempts) {
      let res: unknown;
      try {
        res = await this.ai.run(this.model, attempt);
      } catch (err) {
        lastError = err; // wrong shape / transient — try the next
        continue;
      }
      const text = extractWorkersAiText(res);
      if (!text) continue;
      const scores = parseContentScores(text);
      if (scores) {
        if (this.kv)
          await setCachedScore(this.kv, contentHash, scores, this.model);
        return scores;
      }
    }
    // Non-thin content that produced no usable scores is a real failure (bad
    // request shape, provider error, or unparseable output) — throw so the
    // caller counts it, rather than silently reporting the crawl as fully scored.
    throw new Error(
      `Workers AI (${this.model}) produced no usable content scores` +
        (lastError instanceof Error ? `: ${lastError.message}` : ""),
    );
  }
}
