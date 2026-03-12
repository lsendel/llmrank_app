/**
 * In-memory queue adapter for development and testing
 * WARNING: Not suitable for production - data is lost on restart
 */

import type {
  QueueAdapter,
  QueueMessage,
  QueueStats,
} from "./types";

interface StoredMessage<T = unknown> {
  id: string;
  data: T;
  timestamp: number;
  attempts: number;
  maxAttempts: number;
  executeAt: number;
}

export class MemoryQueueAdapter implements QueueAdapter {
  private queues = new Map<string, StoredMessage[]>();
  private processing = new Map<string, Map<string, StoredMessage>>();
  private deadLetter = new Map<string, StoredMessage[]>();
  private counters = new Map<string, { completed: number; failed: number }>();

  async enqueue<T>(
    queue: string,
    data: T,
    options: {
      delay?: number;
      maxAttempts?: number;
      deduplicationId?: string;
    } = {},
  ): Promise<string> {
    const messageId = options.deduplicationId ?? this.generateMessageId(queue);

    const message: StoredMessage<T> = {
      id: messageId,
      data,
      timestamp: Date.now(),
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      executeAt: Date.now() + (options.delay ?? 0),
    };

    if (!this.queues.has(queue)) {
      this.queues.set(queue, []);
    }

    this.queues.get(queue)!.push(message);

    return messageId;
  }

  async dequeue<T>(
    queue: string,
    _timeout?: number,
  ): Promise<QueueMessage<T> | null> {
    const messages = this.queues.get(queue) ?? [];
    const now = Date.now();

    // Find first ready message
    const index = messages.findIndex((msg) => msg.executeAt <= now);

    if (index === -1) {
      return null;
    }

    const [message] = messages.splice(index, 1);
    message.attempts += 1;

    // Move to processing
    if (!this.processing.has(queue)) {
      this.processing.set(queue, new Map());
    }
    this.processing.get(queue)!.set(message.id, message);

    return {
      id: message.id,
      data: message.data as T,
      timestamp: message.timestamp,
      attempts: message.attempts,
      maxAttempts: message.maxAttempts,
    };
  }

  async ack(queue: string, messageId: string): Promise<void> {
    const processingMap = this.processing.get(queue);
    if (processingMap) {
      processingMap.delete(messageId);
    }

    // Update stats
    if (!this.counters.has(queue)) {
      this.counters.set(queue, { completed: 0, failed: 0 });
    }
    this.counters.get(queue)!.completed += 1;
  }

  async nack(
    queue: string,
    messageId: string,
    options: { delay?: number } = {},
  ): Promise<void> {
    const processingMap = this.processing.get(queue);
    const message = processingMap?.get(messageId);

    if (!message) {
      return;
    }

    processingMap!.delete(messageId);

    if (message.attempts >= message.maxAttempts) {
      // Move to dead letter queue
      if (!this.deadLetter.has(queue)) {
        this.deadLetter.set(queue, []);
      }
      this.deadLetter.get(queue)!.push(message);

      // Update stats
      if (!this.counters.has(queue)) {
        this.counters.set(queue, { completed: 0, failed: 0 });
      }
      this.counters.get(queue)!.failed += 1;
      return;
    }

    // Re-queue with delay
    const retryDelay = options.delay ?? this.calculateBackoff(message.attempts);
    message.executeAt = Date.now() + retryDelay;

    if (!this.queues.has(queue)) {
      this.queues.set(queue, []);
    }
    this.queues.get(queue)!.push(message);
  }

  async depth(queue: string): Promise<number> {
    const messages = this.queues.get(queue) ?? [];
    const now = Date.now();
    return messages.filter((msg) => msg.executeAt <= now).length;
  }

  async purge(queue: string): Promise<number> {
    const messages = this.queues.get(queue) ?? [];
    const count = messages.length;
    this.queues.delete(queue);
    return count;
  }

  async stats(queue: string): Promise<QueueStats> {
    const depth = await this.depth(queue);
    const processing = this.processing.get(queue)?.size ?? 0;
    const queueStats = this.counters.get(queue) ?? { completed: 0, failed: 0 };

    return {
      depth,
      processing,
      failed: queueStats.failed,
      completed: queueStats.completed,
    };
  }

  async health(): Promise<{
    status: "healthy" | "degraded" | "down";
    message?: string;
  }> {
    return { status: "healthy" };
  }

  /**
   * Get all queues (for testing/debugging)
   */
  getAllQueues(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Get dead letter queue (for testing/debugging)
   */
  getDeadLetterQueue(queue: string): unknown[] {
    return this.deadLetter.get(queue)?.map((msg) => msg.data) ?? [];
  }

  private calculateBackoff(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt - 1), 32000);
  }

  private generateMessageId(queue: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `msg:${queue}:${timestamp}:${random}`;
  }
}
