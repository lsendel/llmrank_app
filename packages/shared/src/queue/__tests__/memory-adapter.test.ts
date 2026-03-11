import { describe, it, expect, beforeEach } from "vitest";
import { MemoryQueueAdapter } from "../memory-adapter";

describe("MemoryQueueAdapter", () => {
  let adapter: MemoryQueueAdapter;

  beforeEach(() => {
    adapter = new MemoryQueueAdapter();
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
      const message = await adapter.dequeue("empty-queue");
      expect(message).toBeNull();
    });

    it("should not dequeue delayed messages before they're ready", async () => {
      await adapter.enqueue("test-queue", { delayed: true }, {
        delay: 5000,
      });

      const message = await adapter.dequeue("test-queue");
      expect(message).toBeNull();
    });

    it("should dequeue delayed messages after delay expires", async () => {
      await adapter.enqueue("test-queue", { delayed: true }, {
        delay: 0, // No delay
      });

      const message = await adapter.dequeue("test-queue");
      expect(message).toBeDefined();
      expect(message?.data).toEqual({ delayed: true });
    });

    it("should use deduplication ID when provided", async () => {
      const dedupeId = "unique-job-123";

      const id1 = await adapter.enqueue("test-queue", { test: 1 }, {
        deduplicationId: dedupeId,
      });

      expect(id1).toBe(dedupeId);
    });

    it("should respect max attempts option", async () => {
      await adapter.enqueue("test-queue", { test: true }, {
        maxAttempts: 5,
      });

      const message = await adapter.dequeue("test-queue");
      expect(message?.maxAttempts).toBe(5);
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
      expect(stats.processing).toBe(0);
    });

    it("should retry message on nack", async () => {
      await adapter.enqueue("test-queue", { test: true }, {
        maxAttempts: 3,
      });

      const msg1 = await adapter.dequeue("test-queue");
      expect(msg1?.attempts).toBe(1);

      // Nack to retry with no delay
      await adapter.nack("test-queue", msg1!.id, { delay: 0 });

      const msg2 = await adapter.dequeue("test-queue");
      expect(msg2?.attempts).toBe(2);
      expect(msg2?.id).toBe(msg1?.id);
    });

    it("should move to dead letter queue after max retries", async () => {
      await adapter.enqueue("test-queue", { test: true }, {
        maxAttempts: 2,
      });

      // Attempt 1
      const msg1 = await adapter.dequeue("test-queue");
      await adapter.nack("test-queue", msg1!.id, { delay: 0 });

      // Attempt 2
      const msg2 = await adapter.dequeue("test-queue");
      await adapter.nack("test-queue", msg2!.id, { delay: 0 });

      // Check stats
      const stats = await adapter.stats("test-queue");
      expect(stats.failed).toBe(1);
      expect(stats.depth).toBe(0);

      // Check dead letter queue
      const dlq = adapter.getDeadLetterQueue("test-queue");
      expect(dlq).toHaveLength(1);
      expect(dlq[0]).toEqual({ test: true });
    });

    it("should handle nack with delay", async () => {
      await adapter.enqueue("test-queue", { test: true });

      const msg1 = await adapter.dequeue("test-queue");
      await adapter.nack("test-queue", msg1!.id, { delay: 1000 });

      // Should not be available immediately
      const msg2 = await adapter.dequeue("test-queue");
      expect(msg2).toBeNull();
    });
  });

  describe("stats and operations", () => {
    it("should return queue depth", async () => {
      await adapter.enqueue("test-queue", { a: 1 });
      await adapter.enqueue("test-queue", { a: 2 });
      await adapter.enqueue("test-queue", { a: 3 });

      const depth = await adapter.depth("test-queue");
      expect(depth).toBe(3);
    });

    it("should return queue stats", async () => {
      await adapter.enqueue("test-queue", { a: 1 });
      await adapter.enqueue("test-queue", { a: 2 });

      const msg1 = await adapter.dequeue("test-queue");
      await adapter.ack("test-queue", msg1!.id);

      await adapter.dequeue("test-queue");
      // msg2 is still processing

      const stats = await adapter.stats("test-queue");
      expect(stats.depth).toBe(0);
      expect(stats.processing).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(0);
    });

    it("should purge queue", async () => {
      await adapter.enqueue("test-queue", { a: 1 });
      await adapter.enqueue("test-queue", { a: 2 });

      const deleted = await adapter.purge("test-queue");
      expect(deleted).toBe(2);

      const depth = await adapter.depth("test-queue");
      expect(depth).toBe(0);
    });

    it("should report healthy status", async () => {
      const health = await adapter.health();
      expect(health.status).toBe("healthy");
    });

    it("should track multiple queues independently", async () => {
      await adapter.enqueue("queue-a", { queue: "a" });
      await adapter.enqueue("queue-b", { queue: "b" });

      const msgA = await adapter.dequeue("queue-a");
      expect(msgA?.data).toEqual({ queue: "a" });

      const msgB = await adapter.dequeue("queue-b");
      expect(msgB?.data).toEqual({ queue: "b" });

      const queues = adapter.getAllQueues();
      expect(queues).toContain("queue-a");
      expect(queues).toContain("queue-b");
    });
  });

  describe("edge cases", () => {
    it("should handle ack on non-existent message", async () => {
      await expect(
        adapter.ack("test-queue", "non-existent-id"),
      ).resolves.not.toThrow();
    });

    it("should handle nack on non-existent message", async () => {
      await expect(
        adapter.nack("test-queue", "non-existent-id"),
      ).resolves.not.toThrow();
    });

    it("should handle operations on empty queue", async () => {
      const depth = await adapter.depth("empty-queue");
      expect(depth).toBe(0);

      const stats = await adapter.stats("empty-queue");
      expect(stats).toEqual({
        depth: 0,
        processing: 0,
        failed: 0,
        completed: 0,
      });

      const deleted = await adapter.purge("empty-queue");
      expect(deleted).toBe(0);
    });
  });
});
