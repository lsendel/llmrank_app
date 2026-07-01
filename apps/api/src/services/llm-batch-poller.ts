import Anthropic from "@anthropic-ai/sdk";
import { createAppDb, crawlQueries, pageQueries } from "@llm-boost/db";
import { LLMScorer, estimateCostUsd, setCachedScore } from "@llm-boost/llm";
import { createLogger } from "@llm-boost/shared";
import { buildSiteContext, rescorePageFromStored } from "./factor-rescoring";
import {
  LLM_BATCH_KV_PREFIX,
  markLLMStatus,
  recordContentScoringUsage,
  type PendingScoreBatch,
} from "./llm-scoring";

const log = createLogger({ service: "llm-batch-poller" });

/** Anthropic Message Batches bill at 50% of standard rates. */
const BATCH_COST_MULTIPLIER = 0.5;
/** Anthropic batches expire ~24h; stop re-polling a batch that never ends. */
const ORPHAN_AFTER_MS = 26 * 60 * 60 * 1000;

/** A confirmed-gone batch (vs a transient 5xx/timeout that should be retried). */
function isBatchGone(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("not found") ||
    m.includes("404") ||
    m.includes("expired") ||
    m.includes("does not exist") ||
    m.includes("no longer available")
  );
}

/**
 * Poll pending per-crawl content-scoring batches (submitted by
 * runPerCrawlSonnetScoring) and apply their results to D1. Pending batches are
 * tracked in KV (`llm-batch:<batchId>` -> PendingScoreBatch, 26h TTL), so this
 * needs no dedicated table. On completion each result is applied via
 * rescorePageFromStored (recomputing the page's headline + issues), the KV score
 * cache is backfilled (so re-crawls of unchanged pages are free), one aggregated
 * 50%-priced llm_usage row is recorded, and the KV tracking key is deleted.
 * Runs on the 5-minute cron alongside the Supabase batch poller.
 */
export async function pollLLMScoreBatches(env: {
  d1: D1Database;
  ANTHROPIC_API_KEY: string;
  KV?: KVNamespace;
}): Promise<{ polled: number; completed: number }> {
  const kv = env.KV;
  if (!kv) return { polled: 0, completed: 0 };

  const listed = await kv.list({ prefix: LLM_BATCH_KV_PREFIX });
  const keys = listed.keys ?? [];
  if (keys.length === 0) return { polled: 0, completed: 0 };

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const appDb = createAppDb(env.d1);
  let completed = 0;

  for (const key of keys) {
    const meta = (await kv.get(key.name, "json")) as PendingScoreBatch | null;
    if (!meta) {
      await kv.delete(key.name).catch(() => {});
      continue;
    }
    const batchId = key.name.slice(LLM_BATCH_KV_PREFIX.length);
    const ageMs = Date.now() - new Date(meta.submittedAt).getTime();

    try {
      const batch = await client.messages.batches.retrieve(batchId);

      if (batch.processing_status !== "ended") {
        // Still processing — but if it's well past expiry and STILL not ended,
        // stop re-polling forever and surface it.
        if (ageMs > ORPHAN_AFTER_MS) {
          await markLLMStatus(kv, meta.jobId, {
            status: "unavailable",
            scored: 0,
            failed: 0,
          });
          await kv.delete(key.name).catch(() => {});
          log.warn("Batch never ended within 26h — giving up", {
            batchId,
            jobId: meta.jobId,
          });
        }
        continue;
      }

      // Ended — apply each result to D1 (reconstructing the headline via the same
      // path the sync scorer + factor-rescore endpoint use).
      const job = await crawlQueries(appDb).getById(meta.jobId);
      const siteContext = buildSiteContext(job?.siteContext);
      const scorer = new LLMScorer({
        anthropicApiKey: env.ANTHROPIC_API_KEY,
        model: meta.model,
      });

      let scored = 0;
      let failed = 0;
      let inTok = 0;
      let outTok = 0;

      for await (const result of await client.messages.batches.results(
        batchId,
      )) {
        if (result.result.type !== "succeeded") {
          failed++;
          continue;
        }
        const message = result.result.message;
        // Anthropic BILLED every "succeeded" result — count its tokens even if we
        // can't parse/apply it, so llm_usage (+ the budget cap) reflects real spend.
        const u = message.usage;
        if (u) {
          inTok += u.input_tokens ?? 0;
          outTok += u.output_tokens ?? 0;
        }
        try {
          const scores = scorer.processBatchResult(message);
          if (!scores) {
            failed++;
            continue;
          }
          const page = await pageQueries(appDb).getById(result.custom_id);
          if (!page) {
            failed++;
            continue;
          }
          const outcome = await rescorePageFromStored({
            db: appDb,
            jobId: meta.jobId,
            page,
            siteContext,
            llmScores: scores,
          });
          if (outcome === "updated") scored++;
          // Backfill the KV score cache so an unchanged re-crawl is free.
          if (page.contentHash) {
            await setCachedScore(
              kv,
              page.contentHash,
              scores,
              meta.model,
            ).catch(() => {});
          }
        } catch (err) {
          failed++;
          log.error("Failed to apply batch result", {
            customId: result.custom_id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      await markLLMStatus(kv, meta.jobId, {
        status: failed === 0 ? "ok" : scored === 0 ? "unavailable" : "partial",
        scored,
        failed,
      });

      // The successful KV delete is the exactly-once commit point: record the
      // aggregated 50%-priced usage row ONLY if the delete succeeds. If delete
      // fails, the key survives and the next tick re-applies (idempotent) +
      // re-deletes + records exactly once — so a delete failure can never
      // double-charge. (A worker crash between a successful delete and the usage
      // write under-counts one batch — safer than double-counting spend.)
      let deleted = false;
      try {
        await kv.delete(key.name);
        deleted = true;
      } catch (err) {
        log.error("Batch key delete failed — usage deferred to next tick", {
          batchId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      if (!deleted) continue;

      await recordContentScoringUsage(appDb, {
        inputTokens: inTok,
        outputTokens: outTok,
        model: meta.model,
        costUsd:
          estimateCostUsd(meta.model, inTok, outTok) * BATCH_COST_MULTIPLIER,
        projectId: meta.projectId,
        ownerId: meta.ownerId,
        plan: meta.plan,
      });
      completed++;
      log.info("Applied content-scoring batch (50% cost)", {
        batchId,
        jobId: meta.jobId,
        scored,
        failed,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Only give up on a CONFIRMED-gone batch. Transient errors stay pending so
      // the batch is re-collected next tick (failing here would discard results).
      if (isBatchGone(msg)) {
        await markLLMStatus(kv, meta.jobId, {
          status: "unavailable",
          scored: 0,
          failed: 0,
        });
        await kv.delete(key.name).catch(() => {});
        log.warn("Batch gone (expired/not found)", {
          batchId,
          jobId: meta.jobId,
        });
      } else {
        log.error("Batch poll error (will retry next tick)", {
          batchId,
          error: msg,
        });
      }
    }
  }

  return { polled: keys.length, completed };
}
