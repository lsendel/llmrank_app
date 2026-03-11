/**
 * Queue abstraction layer - supports multiple queue backends
 */

export interface QueueMessage<T = unknown> {
  id: string;
  data: T;
  timestamp: number;
  attempts: number;
  maxAttempts?: number;
  delay?: number;
}

export interface QueueAdapter {
  /**
   * Enqueue a message to be processed
   */
  enqueue<T>(
    queue: string,
    data: T,
    options?: {
      delay?: number;
      maxAttempts?: number;
      deduplicationId?: string;
    },
  ): Promise<string>;

  /**
   * Dequeue a message for processing
   */
  dequeue<T>(queue: string, timeout?: number): Promise<QueueMessage<T> | null>;

  /**
   * Acknowledge successful message processing
   */
  ack(queue: string, messageId: string): Promise<void>;

  /**
   * Negative acknowledgment - retry message
   */
  nack(
    queue: string,
    messageId: string,
    options?: { delay?: number },
  ): Promise<void>;

  /**
   * Get queue depth (approximate count)
   */
  depth(queue: string): Promise<number>;

  /**
   * Purge all messages from queue
   */
  purge(queue: string): Promise<number>;

  /**
   * Get queue statistics
   */
  stats(queue: string): Promise<QueueStats>;

  /**
   * Health check for queue backend
   */
  health(): Promise<{ status: "healthy" | "degraded" | "down"; message?: string }>;
}

export interface QueueStats {
  depth: number;
  processing: number;
  failed: number;
  completed: number;
}

export const QUEUE_NAMES = {
  CRAWL_JOBS: "crawl:jobs",
  CRAWL_RESULTS: "crawl:results",
  SCORING: "scoring:pages",
  VISIBILITY_CHECKS: "visibility:checks",
  NOTIFICATIONS: "notifications:send",
  EXPORTS: "exports:generate",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
