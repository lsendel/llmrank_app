import { eq, and, gte, lt, sql, desc } from "drizzle-orm";
import type { Database } from "../client";
import { analyticsEvents, analyticsDailyRollups } from "../schema/analytics";

const FIRST_PARTY_PROJECT_ID = "00000000-0000-0000-0000-000000000000";

export function analyticsQueries(db: Database) {
  return {
    async insertEvent(data: {
      projectId?: string | null;
      event: string;
      domain: string;
      path: string;
      referrer?: string | null;
      userAgent?: string | null;
      sourceType:
        | "organic"
        | "ai_referral"
        | "ai_bot"
        | "direct"
        | "social"
        | "other";
      aiProvider?: string | null;
      country?: string | null;
      botScore?: number | null;
      metadata?: Record<string, unknown>;
    }) {
      const [row] = await db
        .insert(analyticsEvents)
        .values({
          projectId: data.projectId ?? null,
          event: data.event,
          domain: data.domain,
          path: data.path,
          referrer: data.referrer ?? null,
          userAgent: data.userAgent ?? null,
          sourceType: data.sourceType,
          aiProvider: data.aiProvider ?? null,
          country: data.country ?? null,
          botScore: data.botScore ?? null,
          metadata: data.metadata ?? {},
        })
        .returning();
      return row;
    },

    async getSummary(projectId: string, days: number) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().split("T")[0];

      const rows = await db
        .select({
          event: analyticsDailyRollups.event,
          sourceType: analyticsDailyRollups.sourceType,
          aiProvider: analyticsDailyRollups.aiProvider,
          total: sql<number>`sum(${analyticsDailyRollups.count})::int`,
        })
        .from(analyticsDailyRollups)
        .where(
          and(
            eq(analyticsDailyRollups.projectId, projectId),
            gte(analyticsDailyRollups.date, sinceStr),
          ),
        )
        .groupBy(
          analyticsDailyRollups.event,
          analyticsDailyRollups.sourceType,
          analyticsDailyRollups.aiProvider,
        );

      return rows;
    },

    /**
     * Get summary for a specific date range (inclusive start, exclusive end).
     * Used for trend calculations comparing current vs previous period.
     */
    async getSummaryForRange(
      projectId: string,
      startDate: string,
      endDate: string,
    ) {
      const rows = await db
        .select({
          event: analyticsDailyRollups.event,
          sourceType: analyticsDailyRollups.sourceType,
          aiProvider: analyticsDailyRollups.aiProvider,
          total: sql<number>`sum(${analyticsDailyRollups.count})::int`,
        })
        .from(analyticsDailyRollups)
        .where(
          and(
            eq(analyticsDailyRollups.projectId, projectId),
            gte(analyticsDailyRollups.date, startDate),
            lt(analyticsDailyRollups.date, endDate),
          ),
        )
        .groupBy(
          analyticsDailyRollups.event,
          analyticsDailyRollups.sourceType,
          analyticsDailyRollups.aiProvider,
        );

      return rows;
    },

    async getAiTrafficByDay(projectId: string, days: number) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().split("T")[0];

      return db
        .select({
          date: analyticsDailyRollups.date,
          sourceType: analyticsDailyRollups.sourceType,
          aiProvider: analyticsDailyRollups.aiProvider,
          count: analyticsDailyRollups.count,
        })
        .from(analyticsDailyRollups)
        .where(
          and(
            eq(analyticsDailyRollups.projectId, projectId),
            gte(analyticsDailyRollups.date, sinceStr),
            sql`${analyticsDailyRollups.sourceType} IN ('ai_bot', 'ai_referral')`,
          ),
        )
        .orderBy(desc(analyticsDailyRollups.date));
    },

    /**
     * Top pages by AI traffic. Queries raw events since rollups don't
     * include path dimension. Bounded by retention window (pruneOldEvents)
     * so data is only available within the retention period.
     */
    async getTopPages(projectId: string, days: number, limit = 10) {
      const since = new Date();
      since.setDate(since.getDate() - days);

      return db
        .select({
          path: analyticsEvents.path,
          totalVisits: sql<number>`count(*)::int`,
          aiVisits: sql<number>`count(*) filter (where ${analyticsEvents.sourceType} in ('ai_bot', 'ai_referral'))::int`,
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.projectId, projectId),
            gte(analyticsEvents.createdAt, since),
          ),
        )
        .groupBy(analyticsEvents.path)
        .orderBy(
          sql`count(*) filter (where ${analyticsEvents.sourceType} in ('ai_bot', 'ai_referral')) desc`,
        )
        .limit(limit);
    },

    async aggregateDay(targetDate: string) {
      await db.execute(sql`
        INSERT INTO analytics_daily_rollups (id, project_id, date, event, source_type, ai_provider, country, count)
        SELECT
          gen_random_uuid(),
          COALESCE(project_id, ${FIRST_PARTY_PROJECT_ID}::uuid),
          ${targetDate}::date,
          event,
          source_type,
          COALESCE(ai_provider, 'none'),
          COALESCE(country, 'unknown'),
          count(*)::int
        FROM analytics_events
        WHERE created_at >= ${targetDate}::date
          AND created_at < (${targetDate}::date + interval '1 day')
        GROUP BY project_id, event, source_type, ai_provider, country
        ON CONFLICT (project_id, date, event, source_type, ai_provider, country)
        DO UPDATE SET count = EXCLUDED.count
      `);
    },

    async pruneOldEvents(olderThanDays: number, batchSize = 5000) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);

      let deleted = batchSize;
      while (deleted >= batchSize) {
        const result = await db.execute(sql`
          DELETE FROM analytics_events
          WHERE id IN (
            SELECT id FROM analytics_events
            WHERE created_at < ${cutoff}
            LIMIT ${batchSize}
          )
        `);
        deleted = result.rowCount ?? 0;
      }
    },
  };
}
