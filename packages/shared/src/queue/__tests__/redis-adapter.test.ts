import { describe, it, expect, beforeEach } from "vitest";
import { RedisQueueAdapter } from "../redis-adapter";
import type { RedisClient } from "../redis-adapter";

// Mock Redis client for testing
class MockRedisClient implements RedisClient {
  private data = new Map<string, string>();
  private lists = new Map<string, string[]>();
  private sortedSets = new Map<string, Map<string, number>>();

  async rpush(key: string, ...values: string[]): Promise<number> {
    const list = this.lists.get(key) ?? [];
    list.push(...values);
    this.lists.set(key, list);
    return list.length;
  }

  async blpop(key: string, _timeout: number): Promise<[string, string] | null> {
    const list = this.lists.get(key);
    if (!list || list.length === 0) return null;
    const value = list.shift()!;
    return [key, value];
  }

  async lpop(key: string): Promise<string | null> {
    const list = this.lists.get(key);
    if (!list || list.length === 0) return null;
    return list.shift()!;
  }

  async llen(key: string): Promise<number> {
    return this.lists.get(key)?.length ?? 0;
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.data.delete(key) || this.lists.delete(key) || this.sortedSets.delete(key)) {
        count++;
      }
    }
    return count;
  }

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(
    key: string,
    value: string,
    _options?: { ex?: number },
  ): Promise<void> {
    this.data.set(key, value);
  }

  async incr(key: string): Promise<number> {
    const current = parseInt(this.data.get(key) ?? "0", 10);
    const next = current + 1;
    this.data.set(key, next.toString());
    return next;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    const set = this.sortedSets.get(key) ?? new Map();
    const isNew = !set.has(member);
    set.set(member, score);
    this.sortedSets.set(key, set);
    return isNew ? 1 : 0;
  }

  async zrangebyscore(
    key: string,
    min: number,
    max: number,
    _options?: { limit?: { offset: number; count: number } },
  ): Promise<string[]> {
    const set = this.sortedSets.get(key);
    if (!set) return [];

    return Array.from(set.entries())
      .filter(([, score]) => score >= min && score <= max)
      .sort(([, a], [, b]) => a - b)
      .map(([member]) => member);
  }

  async zrem(key: string, member: string): Promise<number> {
    const set = this.sortedSets.get(key);
    if (!set) return 0;
    return set.delete(member) ? 1 : 0;
  }

  async ping(): Promise<string> {
    return "PONG";
  }

  // Test helper
  clear() {
    this.data.clear();
    this.lists.clear();
    this.sortedSets.clear();
  }
}

describe("RedisQueueAdapter", () => {
  let redis: MockRedisClient;
  let adapter: RedisQueueAdapter;

  beforeEach(() => {
    redis = new MockRedisClient();
    adapter = new RedisQueueAdapter(redis);
  });

  describe("enqueue and dequeue", () => {
    it("should enqueue and dequeue a message", async () => {
      const messageId = await adapter.enqueue("test-queue", { foo: "bar" });

      expect(messageId).toBeTruthy();

      const message = await adapter.dequeue("test-queue");

      expect(message).toBeDefined();
      expect(message?.id).toBe(messageId);
      expect(message?.data).toEqual({ foo: "bar" });
      expect(message?.attempts).toBe(1);
    });

    it("should return null when queue is empty", async () => {
      const message = await adapter.dequeue("empty-queue", 0);
      expect(message).toBeNull();
    });

    it("should handle delayed messages", async () => {
      const messageId = await adapter.enqueue("test-queue", { delayed: true }, {
        delay: 5000,
      });

      // Should not be available immediately
      let message = await adapter.dequeue("test-queue", 0);
      expect(message).toBeNull();

      // Manually move delayed messages (simulate time passing)
      const delayedKey = "queue:test-queue:delayed";
      const members = await redis.zrangebyscore(delayedKey, 0, Date.now() + 10000);
      for (const member of members) {
        await redis.rpush("queue:test-queue", member);
        await redis.zrem(delayedKey, member);
      }

      // Now it should be available
      message = await adapter.dequeue("test-queue", 0);
      expect(message).toBeDefined();
      expect(message?.id).toBe(messageId);
    });

    it("should use deduplication ID when provided", async () => {
      const dedupeId = "unique-job-123";

      const id1 = await adapter.enqueue("test-queue", { test: 1 }, {
        deduplicationId: dedupeId,
      });

      expect(id1).toBe(dedupeId);
    });
  });

  describe("ack and nack", () => {
    it("should acknowledge successful processing", async () => {
      await adapter.enqueue("test-queue", { test: true });
      const message = await adapter.dequeue("test-queue");

      expect(message).toBeDefined();

      await adapter.ack("test-queue", message!.id);

      const stats = await adapter.stats("test-queue");
      expect(stats.completed).toBe(1);
    });

    it("should retry message on nack", async () => {
      await adapter.enqueue("test-queue", { test: true }, {
        maxAttempts: 3,
      });

      const msg1 = await adapter.dequeue("test-queue");
      expect(msg1?.attempts).toBe(1);

      // Nack to retry
      await adapter.nack("test-queue", msg1!.id, { delay: 0 });

      // Move delayed messages
      const delayedKey = "queue:test-queue:delayed";
      const members = await redis.zrangebyscore(delayedKey, 0, Date.now() + 10000);
      for (const member of members) {
        await redis.rpush("queue:test-queue", member);
        await redis.zrem(delayedKey, member);
      }

      const msg2 = await adapter.dequeue("test-queue");
      expect(msg2?.attempts).toBe(2);
    });

    it("should move to dead letter queue after max retries", async () => {
      await adapter.enqueue("test-queue", { test: true }, {
        maxAttempts: 2,
      });

      // Attempt 1
      const msg1 = await adapter.dequeue("test-queue");
      await adapter.nack("test-queue", msg1!.id, { delay: 0 });

      // Move delayed
      const delayedKey = "queue:test-queue:delayed";
      let members = await redis.zrangebyscore(delayedKey, 0, Date.now() + 10000);
      for (const member of members) {
        await redis.rpush("queue:test-queue", member);
        await redis.zrem(delayedKey, member);
      }

      // Attempt 2
      const msg2 = await adapter.dequeue("test-queue");
      await adapter.nack("test-queue", msg2!.id, { delay: 0 });

      // Check stats - should have 1 failed
      const stats = await adapter.stats("test-queue");
      expect(stats.failed).toBe(1);

      // Main queue should be empty
      const depth = await adapter.depth("test-queue");
      expect(depth).toBe(0);
    });
  });

  describe("stats and health", () => {
    it("should return queue depth", async () => {
      await adapter.enqueue("test-queue", { a: 1 });
      await adapter.enqueue("test-queue", { a: 2 });
      await adapter.enqueue("test-queue", { a: 3 });

      const depth = await adapter.depth("test-queue");
      expect(depth).toBe(3);
    });

    it("should return queue stats", async () => {
      await adapter.enqueue("test-queue", { a: 1 });

      const msg = await adapter.dequeue("test-queue");
      await adapter.ack("test-queue", msg!.id);

      const stats = await adapter.stats("test-queue");
      expect(stats.depth).toBe(0);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(0);
    });

    it("should purge queue", async () => {
      await adapter.enqueue("test-queue", { a: 1 });
      await adapter.enqueue("test-queue", { a: 2 });

      const deleted = await adapter.purge("test-queue");
      expect(deleted).toBeGreaterThan(0);

      const depth = await adapter.depth("test-queue");
      expect(depth).toBe(0);
    });

    it("should report health", async () => {
      const health = await adapter.health();
      expect(health.status).toBe("healthy");
    });
  });
});
