import { createAppDb, outboxEvents, eq, and, lte, sql } from "@llm-boost/db";
import { runLLMScoring, type LLMScoringInput } from "./llm-scoring";
import type { WorkersAi } from "@llm-boost/llm";
import { runIntegrationEnrichments, type EnrichmentInput } from "./enrichments";
import { generateCrawlSummary, type SummaryInput } from "./summary";
import { createLogger } from "@llm-boost/shared";
import { pMap } from "../lib/concurrent";

const MAX_ATTEMPTS = 5;

// How many outbox events to work on at once. Each llm_scoring event already fans
// its page scoring out internally (Workers AI, concurrency 8), so the cap on
// in-flight AI calls is roughly EVENT_CONCURRENCY × 8. Before this, the cron
// drained events strictly sequentially (~13/run) and LLM scoring ran hours
// behind crawls; modest event-level parallelism multiplies throughput while
// staying well under the Workers per-invocation subrequest cap (the LIMIT below
// bounds total work per run regardless of concurrency).
const EVENT_CONCURRENCY = 4;
const EVENT_BATCH_LIMIT = 50;

const _PROCESSABLE_TYPES = [
  "integration_enrichment",
  "llm_scoring",
  "crawl_summary",
] as const;

type ProcessableType = (typeof _PROCESSABLE_TYPES)[number];

interface OutboxEnv {
  ANTHROPIC_API_KEY?: string;
  AI?: WorkersAi;
  KV?: KVNamespace;
  R2?: R2Bucket;
  INTEGRATION_ENCRYPTION_KEY?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
}

async function processEvent(
  type: ProcessableType,
  payload: Record<string, unknown>,
  _d1: D1Database,
  env?: OutboxEnv,
): Promise<void> {
  switch (type) {
    case "llm_scoring": {
      // d1 + ai are bindings — they can't be JSON-serialized into the durable
      // outbox, so re-inject them here from the live processor env. The Workers
      // AI path (ai + d1) is the worker default; anthropicApiKey is only needed
      // for the legacy Supabase/Anthropic path.
      const enriched = {
        ...payload,
        d1: _d1,
        ai: env?.AI ?? payload.ai,
        anthropicApiKey: env?.ANTHROPIC_API_KEY ?? payload.anthropicApiKey,
        kvNamespace: env?.KV ?? payload.kvNamespace,
        r2Bucket: env?.R2 ?? payload.r2Bucket,
      };
      if (!enriched.ai && !enriched.anthropicApiKey) {
        throw new Error(
          "Missing AI binding and anthropicApiKey — cannot run LLM scoring",
        );
      }
      await runLLMScoring(enriched as unknown as LLMScoringInput);
      break;
    }
    case "integration_enrichment": {
      const enriched = {
        ...payload,
        d1: _d1,
        encryptionKey: env?.INTEGRATION_ENCRYPTION_KEY ?? payload.encryptionKey,
        googleClientId: env?.GOOGLE_OAUTH_CLIENT_ID ?? payload.googleClientId,
        googleClientSecret:
          env?.GOOGLE_OAUTH_CLIENT_SECRET ?? payload.googleClientSecret,
        metaAppId: env?.META_APP_ID ?? payload.metaAppId,
        metaAppSecret: env?.META_APP_SECRET ?? payload.metaAppSecret,
      };
      await runIntegrationEnrichments(enriched as unknown as EnrichmentInput);
      break;
    }
    case "crawl_summary": {
      const enriched = {
        ...payload,
        d1: _d1,
        anthropicApiKey: env?.ANTHROPIC_API_KEY ?? payload.anthropicApiKey,
      };
      await generateCrawlSummary(enriched as unknown as SummaryInput);
      break;
    }
  }
}

/**
 * Processes pending outbox events for integration enrichments, LLM scoring,
 * and crawl summaries. Designed to be called from the scheduled cron handler.
 *
 * Only picks up events with types in PROCESSABLE_TYPES, leaving notification
 * events (email:*, webhook:*) untouched for the notification service.
 */
export async function processOutboxEvents(
  d1: D1Database,
  env?: OutboxEnv,
): Promise<{ processed: number; failed: number }> {
  const log = createLogger({ context: "outbox-processor" });
  const db = createAppDb(d1);

  const events = await db
    .select()
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.status, "pending"),
        lte(outboxEvents.availableAt, new Date().toISOString()),
        sql`${outboxEvents.type} IN ('integration_enrichment', 'llm_scoring', 'crawl_summary')`,
        sql`${outboxEvents.attempts} <= ${MAX_ATTEMPTS}`,
      ) as any,
    )
    // Oldest-available first so a large crawl can't perpetually jump ahead of an
    // earlier one (and so ordering is deterministic across runs).
    .orderBy(outboxEvents.availableAt)
    .limit(EVENT_BATCH_LIMIT);

  if (events.length === 0) {
    return { processed: 0, failed: 0 };
  }

  log.info(`Processing ${events.length} outbox events`, {
    types: events.map((e) => e.type),
  });

  let processed = 0;
  let failed = 0;

  // Work the batch with bounded concurrency. JS stays single-threaded, so the
  // processed/failed counters interleave safely across awaits; pMap(settle)
  // ensures one event's failure never aborts the rest of the batch.
  await pMap(
    events,
    async (event) => {
      try {
        await processEvent(
          event.type as ProcessableType,
          (typeof event.payload === "string"
            ? JSON.parse(event.payload)
            : event.payload) as Record<string, unknown>,
          d1,
          env,
        );

        await db
          .update(outboxEvents)
          .set({
            status: "completed",
            processedAt: new Date().toISOString(),
          } as any)
          .where(eq(outboxEvents.id, event.id) as any);

        processed++;
        log.info(`Outbox event completed`, {
          eventId: event.id,
          type: event.type,
        });
      } catch (err) {
        failed++;
        log.error(`Outbox event failed`, {
          eventId: event.id,
          type: event.type,
          error: err instanceof Error ? err.message : String(err),
        });

        await db
          .update(outboxEvents)
          .set({
            attempts: event.attempts + 1,
            availableAt: new Date(Date.now() + 120_000).toISOString(),
          } as any)
          .where(eq(outboxEvents.id, event.id) as any);
      }
    },
    { concurrency: EVENT_CONCURRENCY, settle: true },
  );

  // Mark events that exceeded max attempts as permanently failed
  const staleEvents = await db
    .select({ id: outboxEvents.id })
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.status, "pending"),
        sql`${outboxEvents.attempts} > ${MAX_ATTEMPTS}`,
      ) as any,
    )
    .limit(50);

  if (staleEvents.length > 0) {
    for (const event of staleEvents) {
      await db
        .update(outboxEvents)
        .set({ status: "failed" as any, processedAt: new Date().toISOString() })
        .where(eq(outboxEvents.id, event.id) as any);
    }
    log.warn(
      `Marked ${staleEvents.length} outbox events as permanently failed (exceeded ${MAX_ATTEMPTS} attempts)`,
    );
  }

  log.info(`Outbox processing complete`, { processed, failed });
  return { processed, failed };
}
