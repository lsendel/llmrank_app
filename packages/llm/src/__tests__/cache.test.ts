import { describe, it, expect, vi } from "vitest";
import { getCachedScore, setCachedScore, type KVNamespace } from "../cache";
import type { LLMContentScores } from "@llm-boost/shared";

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => {
      const val = store.get(key);
      return val ? JSON.parse(val) : null;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

const sampleScores: LLMContentScores = {
  clarity: 85,
  authority: 70,
  comprehensiveness: 90,
  structure: 75,
  citation_worthiness: 80,
};

describe("getCachedScore", () => {
  it("returns null on cache miss", async () => {
    const kv = createMockKV();
    const result = await getCachedScore(kv, "abc123");
    expect(result).toBeNull();
    expect(kv.get).toHaveBeenCalledWith("llm-score:abc123", "json");
  });

  it("returns cached data on cache hit", async () => {
    const kv = createMockKV();
    await setCachedScore(kv, "abc123", sampleScores);
    const result = await getCachedScore(kv, "abc123");
    expect(result).toEqual(sampleScores);
  });
});

describe("setCachedScore", () => {
  it("stores data with correct key and TTL", async () => {
    const kv = createMockKV();
    await setCachedScore(kv, "hash456", sampleScores);
    expect(kv.put).toHaveBeenCalledWith(
      "llm-score:hash456",
      JSON.stringify(sampleScores),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
  });

  it("namespaces the key by model so different models don't collide", async () => {
    const kv = createMockKV();
    const sonnet = { ...sampleScores, authority: 90 };
    const haiku = { ...sampleScores, authority: 40 };
    await setCachedScore(kv, "samehash", sonnet, "claude-sonnet-5");
    await setCachedScore(kv, "samehash", haiku, "claude-haiku-4-5");

    // Same content hash, different models → separate entries, no cross-poison.
    expect(await getCachedScore(kv, "samehash", "claude-sonnet-5")).toEqual(
      sonnet,
    );
    expect(await getCachedScore(kv, "samehash", "claude-haiku-4-5")).toEqual(
      haiku,
    );
    // A model with no cached entry misses (doesn't borrow another model's).
    expect(await getCachedScore(kv, "samehash", "gpt-oss")).toBeNull();
    expect(kv.put).toHaveBeenCalledWith(
      "llm-score:claude-sonnet-5:samehash",
      JSON.stringify(sonnet),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
  });
});
