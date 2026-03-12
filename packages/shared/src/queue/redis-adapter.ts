/**
 * Redis-backed queue adapter using Upstash Redis for Cloudflare Workers
 */

import type {
  QueueAdapter,
  QueueMessage,
  QueueStats,
} from "./types";

export interface RedisClient {
  rpush(key: string, ...values: string[]): Promise<number>;
  blpop(key: string, timeout: number): Promise<[string, string] | null>;
  lpop(key: string): Promise<string | null>;
  llen(key: string): Promise<number>;
  del(...keys: string[]): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<void>;
  incr(key: string): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<number>;
  zrangebyscore(
    key: string,
    min: number,
    max: number,
    options?: { limit?: { offset: number; count: number } },
  ): Promise<string[]>;
  zrem(key: string, member: string): Promise<number>;
  ping(): Promise<string>;
}

interface QueueMessageInternal<T = unknown> {
  id: string;
  data: T;
  timestamp: number;
  attempts: number;
  maxAttempts: number;
}

export class RedisQueueAdapter implements QueueAdapter {
  constructor(
    private readonly redis: RedisClient,
    private readonly options: {
      defaultMaxAttempts?: number;
      messageIdPrefix?: string;
    } = {},
  ) {}

  async enqueue<T>(
    queue: string,
    data: T,
    options: {
      delay?: number;
      maxAttempts?: number;
      deduplicationId?: string;
    } = {},
  ): Promise<string> {
    const messageId =
      options.deduplicationId ?? this.generateMessageId(queue);
    const message: QueueMessageInternal<T> = {
      id: messageId,
      data,
      timestamp: Date.now(),
      attempts: 0,
      maxAttempts: options.maxAttempts ?? this.options.defaultMaxAttempts ?? 3,
    };

    const messageJson = JSON.stringify(message);

    if (options.delay && options.delay > 0) {
      // Delayed message - add to sorted set with score = future timestamp
      const executeAt = Date.now() + options.delay;
      await this.redis.zadd(
        this.delayedKey(queue),
        executeAt,
        messageJson,
      );
    } else {
      // Immediate message - push to list
      await this.redis.rpush(this.queueKey(queue), messageJson);
    }

    return messageId;
  }

  async dequeue<T>(
    queue: string,
    timeout: number = 5,
  ): Promise<QueueMessage<T> | null> {
    // First, check for delayed messages that are ready
    await this.moveReadyDelayedMessages(queue);

    // Then dequeue from main queue
    const result = await this.redis.blpop(this.queueKey(queue), timeout);

    if (!result) {
      return null;
    }

    const [, messageJson] = result;
    const message = JSON.parse(messageJson) as QueueMessageInternal<T>;

    // Increment attempt counter
    message.attempts += 1;

    // Store in processing set
    await this.redis.set(
      this.processingKey(queue, message.id),
      JSON.stringify(message),
      { ex: 3600 }, // 1 hour expiry
    );

    return {
      id: message.id,
      data: message.data,
      timestamp: message.timestamp,
      attempts: message.attempts,
      maxAttempts: message.maxAttempts,
    };
  }

  async ack(queue: string, messageId: string): Promise<void> {
    // Remove from processing set
    await this.redis.del(this.processingKey(queue, messageId));

    // Increment completed counter
    await this.redis.incr(this.statsKey(queue, "completed"));
  }

  async nack(
    queue: string,
    messageId: string,
    options: { delay?: number } = {},
  ): Promise<void> {
    // Get message from processing set
    const messageJson = await this.redis.get(
      this.processingKey(queue, messageId),
    );

    if (!messageJson) {
      // Message not found in processing - might have expired
      return;
    }

    const message = JSON.parse(messageJson) as QueueMessageInternal;

    if (message.attempts >= message.maxAttempts) {
      // Max retries exceeded - move to dead letter queue
      await this.redis.rpush(this.deadLetterKey(queue), messageJson);
      await this.redis.incr(this.statsKey(queue, "failed"));
      await this.redis.del(this.processingKey(queue, messageId));
      return;
    }

    // Retry with delay
    const retryDelay = options.delay ?? this.calculateBackoff(message.attempts);
    const executeAt = Date.now() + retryDelay;

    await this.redis.zadd(
      this.delayedKey(queue),
      executeAt,
      JSON.stringify(message),
    );

    // Remove from processing
    await this.redis.del(this.processingKey(queue, messageId));
  }

  async depth(queue: string): Promise<number> {
    return await this.redis.llen(this.queueKey(queue));
  }

  async purge(queue: string): Promise<number> {
    const deleted = await this.redis.del(
      this.queueKey(queue),
      this.delayedKey(queue),
    );
    return deleted;
  }

  async stats(queue: string): Promise<QueueStats> {
    const [depth, processing, failed, completed] = await Promise.all([
      this.depth(queue),
      this.getProcessingCount(queue),
      this.getCounter(queue, "failed"),
      this.getCounter(queue, "completed"),
    ]);

    return { depth, processing, failed, completed };
  }

  async health(): Promise<{
    status: "healthy" | "degraded" | "down";
    message?: string;
  }> {
    try {
      const response = await this.redis.ping();
      if (response === "PONG") {
        return { status: "healthy" };
      }
      return { status: "degraded", message: `Unexpected ping response: ${response}` };
    } catch (error) {
      return {
        status: "down",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Move delayed messages that are ready to the main queue
   */
  private async moveReadyDelayedMessages(queue: string): Promise<void> {
    const now = Date.now();
    const ready = await this.redis.zrangebyscore(
      this.delayedKey(queue),
      0,
      now,
      { limit: { offset: 0, count: 100 } },
    );

    for (const messageJson of ready) {
      // Move to main queue
      await this.redis.rpush(this.queueKey(queue), messageJson);
      // Remove from delayed set
      await this.redis.zrem(this.delayedKey(queue), messageJson);
    }
  }

  private async getProcessingCount(_queue: string): Promise<number> {
    // This is approximate - we'd need to scan all processing keys
    // For now, return 0 (can be improved with a counter)
    return 0;
  }

  private async getCounter(queue: string, stat: string): Promise<number> {
    const value = await this.redis.get(this.statsKey(queue, stat));
    return value ? parseInt(value, 10) : 0;
  }

  private calculateBackoff(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (max)
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 32000);
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5);
    return Math.floor(delay + jitter);
  }

  private generateMessageId(queue: string): string {
    const prefix = this.options.messageIdPrefix ?? "msg";
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${prefix}:${queue}:${timestamp}:${random}`;
  }

  private queueKey(queue: string): string {
    return `queue:${queue}`;
  }

  private delayedKey(queue: string): string {
    return `queue:${queue}:delayed`;
  }

  private processingKey(queue: string, messageId: string): string {
    return `queue:${queue}:processing:${messageId}`;
  }

  private deadLetterKey(queue: string): string {
    return `queue:${queue}:dlq`;
  }

  private statsKey(queue: string, stat: string): string {
    return `queue:${queue}:stats:${stat}`;
  }
}
