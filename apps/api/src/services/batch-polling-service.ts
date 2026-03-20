import Anthropic from "@anthropic-ai/sdk";
import { createDb, batchJobQueries, scoreQueries } from "@llm-boost/db";
import { LLMScorer } from "@llm-boost/llm";
import { createLogger } from "@llm-boost/shared";

const log = createLogger({ service: "batch-polling" });

export async function pollPendingBatches(env: {
  DATABASE_URL: string;
  ANTHROPIC_API_KEY: string;
  KV?: KVNamespace;
  R2?: R2Bucket;
}): Promise<{ polled: number; completed: number }> {
  const db = createDb(env.DATABASE_URL);
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const pending = await batchJobQueries(db).listPending();

  if (pending.length === 0) return { polled: 0, completed: 0 };

  log.info(`Polling ${pending.length} pending batch jobs`);
  let completed = 0;

  for (const job of pending) {
    try {
      const batch = await client.messages.batches.retrieve(job.batchId);

      // Update progress
      await batchJobQueries(db).updateStatus(job.id, {
        status: batch.processing_status,
        completedRequests: batch.request_counts.succeeded,
        failedRequests: batch.request_counts.errored,
      });

      if (batch.processing_status !== "ended") continue;

      // Fetch and process results
      const scorer = new LLMScorer({
        anthropicApiKey: env.ANTHROPIC_API_KEY,
        kvNamespace: env.KV,
      });

      let processed = 0;
      let failed = 0;

      for await (const result of await client.messages.batches.results(
        job.batchId,
      )) {
        if (result.result.type === "succeeded") {
          try {
            const scores = scorer.processBatchResult(result.result.message);
            if (scores) {
              // Look up the score row for this page
              const scoreRow = await scoreQueries(db).getByPage(
                result.custom_id,
              );
              if (scoreRow) {
                await scoreQueries(db).updateDetail(scoreRow.id, {
                  llmContentScores: scores,
                });
              }
              processed++;
            }
          } catch (err) {
            log.error("Failed to process batch result", {
              customId: result.custom_id,
              error: err instanceof Error ? err.message : String(err),
            });
            failed++;
          }
        } else {
          log.warn("Batch result not succeeded", {
            customId: result.custom_id,
            type: result.result.type,
          });
          failed++;
        }
      }

      await batchJobQueries(db).updateStatus(job.id, {
        status: "completed",
        completedRequests: processed,
        failedRequests: failed,
        completedAt: new Date(),
      });

      log.info("Batch job completed", {
        batchId: job.batchId,
        processed,
        failed,
      });
      completed++;
    } catch (err) {
      log.error("Batch polling error", {
        batchId: job.batchId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { polled: pending.length, completed };
}
