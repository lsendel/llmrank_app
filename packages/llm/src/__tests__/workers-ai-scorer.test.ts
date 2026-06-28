import { describe, it, expect, vi } from "vitest";
import {
  WorkersAiScorer,
  extractWorkersAiText,
  parseContentScores,
  DEFAULT_WORKERS_AI_MODEL,
  type WorkersAi,
} from "../workers-ai-scorer";
import type { KVNamespace } from "../cache";

const VALID_JSON =
  '{"clarity":80,"authority":70,"comprehensiveness":75,"structure":85,"citation_worthiness":60}';

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => {
      const v = store.get(key);
      return v ? JSON.parse(v) : null;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

/** ~250 words so it clears the 200-word thin-content gate. */
const richText = Array.from({ length: 250 }, (_, i) => `word${i}`).join(" ");

describe("extractWorkersAiText", () => {
  it("handles the plain { response } shape", () => {
    expect(extractWorkersAiText({ response: "hi" })).toBe("hi");
  });
  it("handles { output_text }", () => {
    expect(extractWorkersAiText({ output_text: "hi" })).toBe("hi");
  });
  it("handles OpenAI-compatible { choices }", () => {
    expect(
      extractWorkersAiText({ choices: [{ message: { content: "hi" } }] }),
    ).toBe("hi");
  });
  it("handles gpt-oss { output: [{ content: [{text}] }] }", () => {
    expect(
      extractWorkersAiText({
        output: [{ content: [{ text: "a" }, { text: "b" }] }],
      }),
    ).toBe("a\nb");
  });
  it("handles a bare string", () => {
    expect(extractWorkersAiText("hi")).toBe("hi");
  });
  it("returns null for null / unknown shapes", () => {
    expect(extractWorkersAiText(null)).toBeNull();
    expect(extractWorkersAiText({})).toBeNull();
    expect(extractWorkersAiText(42)).toBeNull();
  });
});

describe("parseContentScores", () => {
  it("parses plain JSON", () => {
    expect(parseContentScores(VALID_JSON)).toEqual({
      clarity: 80,
      authority: 70,
      comprehensiveness: 75,
      structure: 85,
      citation_worthiness: 60,
    });
  });
  it("parses fenced JSON", () => {
    expect(
      parseContentScores("```json\n" + VALID_JSON + "\n```"),
    ).toMatchObject({ clarity: 80 });
  });
  it("parses JSON wrapped in reasoning prose", () => {
    const text = `Let me think about this carefully.\nFinal answer:\n${VALID_JSON}\nThat's my assessment.`;
    expect(parseContentScores(text)).toMatchObject({ citation_worthiness: 60 });
  });
  it("rejects out-of-range scores (schema validation)", () => {
    const bad =
      '{"clarity":150,"authority":70,"comprehensiveness":75,"structure":85,"citation_worthiness":60}';
    expect(parseContentScores(bad)).toBeNull();
  });
  it("rejects missing fields", () => {
    expect(parseContentScores('{"clarity":80}')).toBeNull();
  });
  it("returns null for non-JSON", () => {
    expect(parseContentScores("no json here")).toBeNull();
  });
});

describe("WorkersAiScorer.scoreContent", () => {
  it("returns the cached score without calling the model", async () => {
    const kv = createMockKV();
    await kv.put("llm-score:hash1", JSON.stringify(JSON.parse(VALID_JSON)));
    const ai: WorkersAi = { run: vi.fn() };
    const scorer = new WorkersAiScorer({ ai, kvNamespace: kv });

    const result = await scorer.scoreContent(richText, "hash1");
    expect(result).toMatchObject({ clarity: 80 });
    expect(ai.run).not.toHaveBeenCalled();
  });

  it("returns null for thin content without calling the model", async () => {
    const ai: WorkersAi = { run: vi.fn() };
    const scorer = new WorkersAiScorer({ ai });
    expect(await scorer.scoreContent("too short", "h")).toBeNull();
    expect(ai.run).not.toHaveBeenCalled();
  });

  it("scores valid content, defaults to gpt-oss-120b, and caches", async () => {
    const kv = createMockKV();
    const ai: WorkersAi = {
      run: vi.fn(async () => ({ response: VALID_JSON })),
    };
    const scorer = new WorkersAiScorer({ ai, kvNamespace: kv });

    const result = await scorer.scoreContent(richText, "hash2");
    expect(result).toMatchObject({ structure: 85 });
    expect(ai.run).toHaveBeenCalledWith(
      DEFAULT_WORKERS_AI_MODEL,
      expect.objectContaining({ response_format: expect.any(Object) }),
    );
    // cached for next time
    expect(await kv.get("llm-score:hash2", "json")).toMatchObject({
      clarity: 80,
    });
  });

  it("uses a configured model override", async () => {
    const ai: WorkersAi = {
      run: vi.fn(async () => ({ response: VALID_JSON })),
    };
    const scorer = new WorkersAiScorer({ ai, model: "@cf/qwen/qwen3-30b" });
    await scorer.scoreContent(richText, "h3");
    expect(ai.run).toHaveBeenCalledWith(
      "@cf/qwen/qwen3-30b",
      expect.anything(),
    );
  });

  it("returns null (keeps deterministic score) when output is unparseable", async () => {
    const ai: WorkersAi = { run: vi.fn(async () => ({ response: "garbage" })) };
    const scorer = new WorkersAiScorer({ ai });
    expect(await scorer.scoreContent(richText, "h4")).toBeNull();
  });

  it("falls back to a plain call when response_format is rejected", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("response_format not supported"))
      .mockResolvedValueOnce({ response: VALID_JSON });
    const scorer = new WorkersAiScorer({ ai: { run } });
    const result = await scorer.scoreContent(richText, "h5");
    expect(result).toMatchObject({ clarity: 80 });
    expect(run).toHaveBeenCalledTimes(2);
    // second (fallback) call omits response_format
    expect(run.mock.calls[1][1]).not.toHaveProperty("response_format");
  });
});
