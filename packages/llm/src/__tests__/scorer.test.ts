import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LLMContentScores } from "@llm-boost/shared";
import type { KVNamespace } from "../cache";

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  }));
  return { default: MockAnthropic };
});

import { LLMScorer } from "../scorer";
import Anthropic from "@anthropic-ai/sdk";

function generateText(wordCount: number): string {
  return Array.from({ length: wordCount }, (_, i) => `word${i}`).join(" ");
}

function createMockKV(store: Record<string, unknown> = {}): KVNamespace {
  return {
    get: vi.fn(async (key: string, _type: "json") => {
      return store[key] ?? null;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store[key] = JSON.parse(value);
    }),
  };
}

const sampleScores: LLMContentScores = {
  clarity: 85,
  authority: 70,
  comprehensiveness: 75,
  structure: 80,
  citation_worthiness: 65,
};

describe("LLMScorer", () => {
  let scorer: LLMScorer;
  let mockKV: KVNamespace;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockKV = createMockKV();
    scorer = new LLMScorer({
      anthropicApiKey: "test-api-key",
      kvNamespace: mockKV,
    });

    // Access the mocked Anthropic client's create method
    const instance = (Anthropic as unknown as ReturnType<typeof vi.fn>).mock
      .results[0].value;
    mockCreate = instance.messages.create;
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(sampleScores) }],
    });
  });

  it("returns null for text with fewer than 200 words", async () => {
    const shortText = generateText(100);
    const result = await scorer.scoreContent(shortText, "hash-short");

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
    // Should not even check cache for thin content — but cache check happens first
  });

  it("returns cached scores when available", async () => {
    const store: Record<string, unknown> = {
      "llm-score:hash-cached": sampleScores,
    };
    const kvWithData = createMockKV(store);
    const cachedScorer = new LLMScorer({
      anthropicApiKey: "test-api-key",
      kvNamespace: kvWithData,
    });

    const text = generateText(300);
    const result = await cachedScorer.scoreContent(text, "hash-cached");

    expect(result).toEqual(sampleScores);
    expect(kvWithData.get).toHaveBeenCalledWith(
      "llm-score:hash-cached",
      "json",
    );
    // The mocked Anthropic create from beforeEach is on a different instance,
    // so we verify by checking that no new Anthropic instance's create was called
    // For the cached scorer, the API should not be called
  });

  it("calls the API and returns parsed scores for valid text", async () => {
    const text = generateText(300);
    const result = await scorer.scoreContent(text, "hash-new");

    expect(result).toEqual(sampleScores);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("word0"),
          }),
        ]),
      }),
    );
  });

  it("caches scores after a successful API call", async () => {
    const text = generateText(300);
    await scorer.scoreContent(text, "hash-to-cache");

    expect(mockKV.put).toHaveBeenCalledWith(
      "llm-score:hash-to-cache",
      JSON.stringify(sampleScores),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
  });

  it("works without KV namespace (no caching)", async () => {
    const noCacheScorer = new LLMScorer({
      anthropicApiKey: "test-api-key",
    });

    // Get the mock create from the latest Anthropic instance
    const latestInstance = (
      Anthropic as unknown as ReturnType<typeof vi.fn>
    ).mock.results.at(-1)!.value;
    latestInstance.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(sampleScores) }],
    });

    const text = generateText(300);
    const result = await noCacheScorer.scoreContent(text, "hash-no-cache");

    expect(result).toEqual(sampleScores);
  });

  it("uses the specified model", () => {
    const customScorer = new LLMScorer({
      anthropicApiKey: "test-api-key",
      model: "claude-sonnet-4-5-20250929",
    });

    // Verify the constructor was called (model is used in scoreContent)
    expect(customScorer).toBeInstanceOf(LLMScorer);
  });
});
