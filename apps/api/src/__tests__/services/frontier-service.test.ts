import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFrontierService } from "../../services/frontier-service";

// ---------------------------------------------------------------------------
// Helpers
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

describe("FrontierService", () => {
  let kv: KVNamespace;

  beforeEach(() => {
    vi.clearAllMocks();
    kv = createMockKV();
  });

  describe("isSeen", () => {
    it("returns false when URL has not been seen", async () => {
      const service = createFrontierService(kv);
      const result = await service.isSeen("proj-1", "https://example.com/page");
      expect(result).toBe(false);
      expect(kv.get).toHaveBeenCalledWith(
        "seen:proj-1:https://example.com/page",
      );
    });

    it("returns true when URL has been marked as seen", async () => {
      const service = createFrontierService(kv);
      await service.markSeen("proj-1", "https://example.com/page");
      const result = await service.isSeen("proj-1", "https://example.com/page");
      expect(result).toBe(true);
    });

    it("uses project-scoped keys to avoid collisions", async () => {
      const service = createFrontierService(kv);
      await service.markSeen("proj-A", "https://example.com/page");

      const seenA = await service.isSeen("proj-A", "https://example.com/page");
      expect(seenA).toBe(true);

      // Different project should not see the same URL
      const seenB = await service.isSeen("proj-B", "https://example.com/page");
      expect(seenB).toBe(false);
    });
  });

  describe("markSeen", () => {
    it("stores the URL with 7-day TTL", async () => {
      const service = createFrontierService(kv);
      await service.markSeen("proj-1", "https://example.com/about");

      expect(kv.put).toHaveBeenCalledWith(
        "seen:proj-1:https://example.com/about",
        expect.any(String),
        { expirationTtl: 60 * 60 * 24 * 7 },
      );
    });

    it("stores an ISO date string as the value", async () => {
      const service = createFrontierService(kv);
      await service.markSeen("proj-1", "https://example.com/test");

      const putCall = (kv.put as ReturnType<typeof vi.fn>).mock.calls[0];
      const storedValue = putCall[1];
      // Should be a valid ISO date string
      expect(new Date(storedValue).toISOString()).toBe(storedValue);
    });
  });

  describe("clearProject", () => {
    it("executes without error (noop in current implementation)", async () => {
      const service = createFrontierService(kv);
      await expect(service.clearProject("proj-1")).resolves.toBeUndefined();
    });
  });
});
