import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrCompute, invalidate } from "../../lib/kv-cache";

// ---------------------------------------------------------------------------
// Mock KV namespace
// ---------------------------------------------------------------------------

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("kv-cache", () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
  });

  it("returns cached value on cache hit without calling computeFn", async () => {
    // Pre-populate the cache
    await kv.put("test-key", JSON.stringify({ data: "cached" }));

    const computeFn = vi.fn().mockResolvedValue({ data: "fresh" });
    const result = await getOrCompute(kv, "test-key", 300, computeFn);

    expect(result).toEqual({ data: "cached" });
    expect(computeFn).not.toHaveBeenCalled();
  });

  it("calls computeFn on cache miss and stores result", async () => {
    const computeFn = vi.fn().mockResolvedValue({ data: "computed" });
    const result = await getOrCompute(kv, "miss-key", 300, computeFn);

    expect(result).toEqual({ data: "computed" });
    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(kv.put).toHaveBeenCalledWith(
      "miss-key",
      JSON.stringify({ data: "computed" }),
      { expirationTtl: 300 },
    );
  });

  it("invalidate removes key from KV", async () => {
    await kv.put("to-delete", JSON.stringify("value"));
    await invalidate(kv, "to-delete");

    expect(kv.delete).toHaveBeenCalledWith("to-delete");
  });

  it("returns correct types for different value shapes", async () => {
    const computeFn = vi.fn().mockResolvedValue([1, 2, 3]);
    const result = await getOrCompute<number[]>(kv, "array-key", 60, computeFn);

    expect(result).toEqual([1, 2, 3]);
    expect(Array.isArray(result)).toBe(true);
  });
});
