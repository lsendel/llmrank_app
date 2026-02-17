import { createDb, outboxEvents, eq, and, lte, sql } from "@llm-boost/db";
import { runLLMScoring, type LLMScoringInput } from "./llm-scoring";
import { runIntegrationEnrichments, type EnrichmentInput } from "./enrichments";
import { generateCrawlSummary, type SummaryInput } from "./summary";
import { createLogger } from "../lib/logger";

const _PROCESSABLE_TYPES = [
  "integration_enrichment",
  "llm_scoring",
  "crawl_summary",
] as const;

type ProcessableType = (typeof _PROCESSABLE_TYPES)[number];

async function processEvent(
  type: ProcessableType,
  payload: Record<string, unknown>,
): Promise<void> {
  switch (type) {
    case "llm_scoring":
      await runLLMScoring(payload as unknown as LLMScoringInput);
      break;
    case "integration_enrichment":
      await runIntegrationEnrichments(payload as unknown as EnrichmentInput);
      break;
    case "crawl_summary":
      await generateCrawlSummary(payload as unknown as SummaryInput);
      break;
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
  databaseUrl: string,
): Promise<{ processed: number; failed: number }> {
  const log = createLogger({ context: "outbox-processor" });
  const db = createDb(databaseUrl);

  const events = await db
    .select()
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.status, "pending"),
        lte(outboxEvents.availableAt, new Date()),
        sql`${outboxEvents.type} IN ('integration_enrichment', 'llm_scoring', 'crawl_summary')`,
      ) as any,
    )
    .limit(10);

  if (events.length === 0) {
    return { processed: 0, failed: 0 };
  }

  log.info(`Processing ${events.length} outbox events`, {
    types: events.map((e) => e.type),
  });

  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      await processEvent(
        event.type as ProcessableType,
        event.payload as Record<string, unknown>,
      );

      await db
        .update(outboxEvents)
        .set({ status: "completed", processedAt: new Date() } as any)
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
          availableAt: new Date(Date.now() + 120_000),
        } as any)
        .where(eq(outboxEvents.id, event.id) as any);
    }
  }

  log.info(`Outbox processing complete`, { processed, failed });
  return { processed, failed };
}
