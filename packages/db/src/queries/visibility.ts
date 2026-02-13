import { eq, desc, sql, and } from "drizzle-orm";
import type { Database } from "../client";
import { visibilityChecks, llmProviderEnum } from "../schema";

type LLMProvider = (typeof llmProviderEnum.enumValues)[number];

export interface VisibilityTrendRow {
  weekStart: string;
  provider: string;
  mentionRate: number;
  citationRate: number;
  totalChecks: number;
}

export function visibilityQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      llmProvider: LLMProvider;
      query: string;
      responseText?: string | null;
      brandMentioned?: boolean;
      urlCited?: boolean;
      citationPosition?: number | null;
      competitorMentions?: unknown;
    }) {
      const [check] = await db
        .insert(visibilityChecks)
        .values(data)
        .returning();
      return check;
    },

    async listByProject(projectId: string) {
      return db.query.visibilityChecks.findMany({
        where: eq(visibilityChecks.projectId, projectId),
        orderBy: [desc(visibilityChecks.checkedAt)],
        limit: 100,
      });
    },

    async getById(id: string) {
      return db.query.visibilityChecks.findFirst({
        where: eq(visibilityChecks.id, id),
      });
    },

    /**
     * Weekly aggregation of brand mention and citation rates per provider.
     * Returns rows sorted by week ascending for charting.
     */
    async getTrends(projectId: string): Promise<VisibilityTrendRow[]> {
      const rows = await db
        .select({
          weekStart: sql<string>`date_trunc('week', ${visibilityChecks.checkedAt})::date::text`,
          provider: visibilityChecks.llmProvider,
          totalChecks: sql<number>`count(*)::int`,
          mentionRate: sql<number>`round(avg(case when ${visibilityChecks.brandMentioned} then 1 else 0 end)::numeric, 2)`,
          citationRate: sql<number>`round(avg(case when ${visibilityChecks.urlCited} then 1 else 0 end)::numeric, 2)`,
        })
        .from(visibilityChecks)
        .where(eq(visibilityChecks.projectId, projectId))
        .groupBy(
          sql`date_trunc('week', ${visibilityChecks.checkedAt})`,
          visibilityChecks.llmProvider,
        )
        .orderBy(sql`date_trunc('week', ${visibilityChecks.checkedAt})`);

      return rows.map((r) => ({
        weekStart: r.weekStart,
        provider: r.provider,
        mentionRate: Number(r.mentionRate),
        citationRate: Number(r.citationRate),
        totalChecks: Number(r.totalChecks),
      }));
    },
  };
}
