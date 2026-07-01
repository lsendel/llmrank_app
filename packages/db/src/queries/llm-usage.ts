import { and, eq, gte, sql } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { llmUsage } from "../schema";

/**
 * LLM cost tracking: one row per LLM API call (token usage + estimated cost).
 * Powers the admin spend view and per-account budget caps. All dates compare
 * against `datetime('now', ...)` since `created_at` is stored in SQLite's
 * `YYYY-MM-DD HH:MM:SS` text format.
 */
export function llmUsageQueries(db: Database) {
  return {
    /** Record one LLM call. Never throws to the caller's critical path — the
     * caller should wrap it in try/catch so a tracking failure can't abort a crawl. */
    async record(data: {
      feature: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      projectId?: string | null;
      userId?: string | null;
      plan?: string | null;
    }) {
      await db.insert(llmUsage).values({
        id: crypto.randomUUID(),
        feature: data.feature,
        model: data.model,
        plan: data.plan ?? null,
        inputTokens: Math.round(data.inputTokens) || 0,
        outputTokens: Math.round(data.outputTokens) || 0,
        costUsd: data.costUsd || 0,
        projectId: data.projectId ?? null,
        userId: data.userId ?? null,
      });
    },

    /** Spend breakdown by feature + model since the start of the current month. */
    async summaryThisMonth() {
      return db
        .select({
          feature: llmUsage.feature,
          model: llmUsage.model,
          calls: sql<number>`count(*)`,
          inputTokens: sql<number>`coalesce(sum(${llmUsage.inputTokens}), 0)`,
          outputTokens: sql<number>`coalesce(sum(${llmUsage.outputTokens}), 0)`,
          costUsd: sql<number>`coalesce(sum(${llmUsage.costUsd}), 0)`,
        })
        .from(llmUsage)
        .where(gte(llmUsage.createdAt, sql`datetime('now', 'start of month')`))
        .groupBy(llmUsage.feature, llmUsage.model)
        .orderBy(sql`coalesce(sum(${llmUsage.costUsd}), 0) desc`);
    },

    /** Total $ + calls this month (headline number). */
    async totalThisMonth() {
      const [row] = await db
        .select({
          calls: sql<number>`count(*)`,
          costUsd: sql<number>`coalesce(sum(${llmUsage.costUsd}), 0)`,
        })
        .from(llmUsage)
        .where(gte(llmUsage.createdAt, sql`datetime('now', 'start of month')`));
      return { calls: row?.calls ?? 0, costUsd: row?.costUsd ?? 0 };
    },

    /** This account's LLM $ this month — used to enforce a per-account budget cap. */
    async accountSpendThisMonth(userId: string) {
      const [row] = await db
        .select({ costUsd: sql<number>`coalesce(sum(${llmUsage.costUsd}), 0)` })
        .from(llmUsage)
        .where(
          and(
            eq(llmUsage.userId, userId),
            gte(llmUsage.createdAt, sql`datetime('now', 'start of month')`),
          ),
        );
      return row?.costUsd ?? 0;
    },
  };
}
