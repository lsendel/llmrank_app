import Anthropic from "@anthropic-ai/sdk";
import { createAgencyDb, batchJobQueries, scoreQueries } from "@llm-boost/db";
import { LLMScorer } from "@llm-boost/llm";
import { createLogger } from "@llm-boost/shared";

const log = createLogger({ service: "batch-polling" });

export async function pollPendingBatches(env: {
  AGENCY_DB_URL: string;
  ANTHROPIC_API_KEY: string;
  KV?: KVNamespace;
  R2?: R2Bucket;
}): Promise<{ polled: number; completed: number }> {
  const db = createAgencyDb(env.AGENCY_DB_URL);
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const pending = await batchJobQueries(db).listPending();

  if (pending.length === 0) return { polled: 0, completed: 0 };

  log.info(`Polling ${pending.length} pending batch jobs`);
  let completed = 0;

  const ORPHAN_AFTER_MS = 26 * 60 * 60 * 1000; // Anthropic batches expire ~24h

  for (const job of pending) {
    // Anthropic batches expire ~24h. Always retrieve first so completed results
    // are never discarded; only give up (mark failed) on a STALE batch that is
    // unretrievable or still not 'ended' past expiry.
    const ageMs = Date.now() - new Date(job.createdAt).getTime();
    const isStale = ageMs > ORPHAN_AFTER_MS;

    try {
      const batch = await client.messages.batches.retrieve(job.batchId);

      // Update progress
      await batchJobQueries(db).updateStatus(job.id, {
        status: batch.processing_status,
        completedRequests: batch.request_counts.succeeded,
        failedRequests: batch.request_counts.errored,
      });

      if (batch.processing_status !== "ended") {
        // Still processing — but if it's well past expiry and STILL not ended,
        // stop re-polling it forever.
        if (isStale) {
          await batchJobQueries(db).updateStatus(job.id, {
            status: "failed",
            error: "Batch never reached 'ended' within 26h (stuck/orphaned)",
            completedAt: new Date(),
          });
          log.warn("Marked stuck batch job failed (not ended within 26h)", {
            batchId: job.batchId,
            ageHours: Math.round(ageMs / 3.6e6),
          });
        }
        continue;
      }

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
              const scoreRow = await scoreQueries(db as any).getByPage(
                result.custom_id,
              );
              if (scoreRow) {
                await scoreQueries(db as any).updateDetail(scoreRow.id, {
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
      // Couldn't retrieve. If it's well past expiry the batch is likely
      // purged/orphaned — mark failed so it stops being re-polled forever.
      // Otherwise leave it pending for a transient retry on the next tick.
      if (isStale) {
        await batchJobQueries(db)
          .updateStatus(job.id, {
            status: "failed",
            error: "Batch unretrievable past 26h (expired/orphaned)",
            completedAt: new Date(),
          })
          .catch(() => {});
        log.warn("Marked unretrievable batch job failed (orphaned)", {
          batchId: job.batchId,
          ageHours: Math.round(ageMs / 3.6e6),
        });
      }
    }
  }

  return { polled: pending.length, completed };
}
