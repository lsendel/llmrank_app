/**
 * Queue service for dispatching crawl jobs and other async work
 */

import type {
  QueueAdapter,
  QueueMessage,
} from "@llm-boost/shared";
import type { CrawlJobPayload } from "@llm-boost/shared";
import { QUEUE_NAMES } from "@llm-boost/shared";
import { ServiceError } from "@llm-boost/shared";

export interface QueueServiceDeps {
  queue: QueueAdapter;
}

export interface CrawlJobOptions {
  priority?: "high" | "normal" | "low";
  delay?: number;
}

export function createQueueService(deps: QueueServiceDeps) {
  return {
    /**
     * Enqueue a crawl job for processing
     */
    async enqueueCrawlJob(
      payload: CrawlJobPayload,
      options: CrawlJobOptions = {},
    ): Promise<string> {
      try {
        const messageId = await deps.queue.enqueue(
          QUEUE_NAMES.CRAWL_JOBS,
          payload,
          {
            delay: options.delay,
            maxAttempts: 3,
            deduplicationId: payload.job_id,
          },
        );

        return messageId;
      } catch (error) {
        throw new ServiceError(
          "QUEUE_ERROR",
          500,
          `Failed to enqueue crawl job: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    /**
     * Dequeue a crawl job for processing (used by worker)
     */
    async dequeueCrawlJob(
      timeout: number = 5,
    ): Promise<QueueMessage<CrawlJobPayload> | null> {
      try {
        return await deps.queue.dequeue<CrawlJobPayload>(
          QUEUE_NAMES.CRAWL_JOBS,
          timeout,
        );
      } catch (error) {
        throw new ServiceError(
          "QUEUE_ERROR",
          500,
          `Failed to dequeue crawl job: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    /**
     * Acknowledge successful job processing
     */
    async ackCrawlJob(messageId: string): Promise<void> {
      try {
        await deps.queue.ack(QUEUE_NAMES.CRAWL_JOBS, messageId);
      } catch (error) {
        throw new ServiceError(
          "QUEUE_ERROR",
          500,
          `Failed to ack crawl job: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    /**
     * Negative acknowledgment - retry job
     */
    async nackCrawlJob(
      messageId: string,
      options: { delay?: number } = {},
    ): Promise<void> {
      try {
        await deps.queue.nack(QUEUE_NAMES.CRAWL_JOBS, messageId, options);
      } catch (error) {
        throw new ServiceError(
          "QUEUE_ERROR",
          500,
          `Failed to nack crawl job: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    /**
     * Get queue stats
     */
    async getQueueStats(queueName: string) {
      try {
        return await deps.queue.stats(queueName);
      } catch (error) {
        throw new ServiceError(
          "QUEUE_ERROR",
          500,
          `Failed to get queue stats: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    /**
     * Get queue health
     */
    async getQueueHealth() {
      try {
        return await deps.queue.health();
      } catch (error) {
        return {
          status: "down" as const,
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    /**
     * Purge a queue (admin only)
     */
    async purgeQueue(queueName: string): Promise<number> {
      try {
        return await deps.queue.purge(queueName);
      } catch (error) {
        throw new ServiceError(
          "QUEUE_ERROR",
          500,
          `Failed to purge queue: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },
  };
}

export type QueueService = ReturnType<typeof createQueueService>;
