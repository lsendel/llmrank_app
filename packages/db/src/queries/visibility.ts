import { eq, and, desc, sql, isNotNull } from "drizzle-orm";
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
      keywordId?: string | null;
      responseText?: string | null;
      brandMentioned?: boolean;
      urlCited?: boolean;
      citedUrl?: string | null;
      citationPosition?: number | null;
      competitorMentions?: unknown;
      sentiment?: string | null;
      brandDescription?: string | null;
      region?: string | null;
      language?: string | null;
    }) {
      const [check] = await db
        .insert(visibilityChecks)
        .values(data)
        .returning();
      return check;
    },

    async listByProject(
      projectId: string,
      filters?: { region?: string; language?: string },
    ) {
      const conditions = [eq(visibilityChecks.projectId, projectId)];
      if (filters?.region) {
        conditions.push(eq(visibilityChecks.region, filters.region));
      }
      if (filters?.language) {
        conditions.push(eq(visibilityChecks.language, filters.language));
      }
      return db.query.visibilityChecks.findMany({
        where: and(...conditions),
        orderBy: [desc(visibilityChecks.checkedAt)],
        limit: 100,
      });
    },

    async getById(id: string) {
      return db.query.visibilityChecks.findFirst({
        where: eq(visibilityChecks.id, id),
      });
    },

    async getLatestForQuery(
      projectId: string,
      query: string,
      provider: string,
    ) {
      const [row] = await db
        .select()
        .from(visibilityChecks)
        .where(
          and(
            eq(visibilityChecks.projectId, projectId),
            eq(visibilityChecks.query, query),
            eq(visibilityChecks.llmProvider, provider as LLMProvider),
          ),
        )
        .orderBy(desc(visibilityChecks.checkedAt))
        .limit(1);
      return row ?? null;
    },

    /**
     * Pages cited by AI platforms, grouped by URL with provider breakdown.
     */
    async getCitedPages(projectId: string) {
      return db
        .select({
          citedUrl: visibilityChecks.citedUrl,
          citationCount: sql<number>`count(*)::int`,
          providers: sql<
            string[]
          >`array_agg(distinct ${visibilityChecks.llmProvider})`,
          avgPosition: sql<number>`round(avg(${visibilityChecks.citationPosition})::numeric, 1)`,
          lastCited: sql<string>`max(${visibilityChecks.checkedAt})::text`,
        })
        .from(visibilityChecks)
        .where(
          and(
            eq(visibilityChecks.projectId, projectId),
            eq(visibilityChecks.urlCited, true),
            isNotNull(visibilityChecks.citedUrl),
          ),
        )
        .groupBy(visibilityChecks.citedUrl)
        .orderBy(desc(sql`count(*)`));
    },

    /**
     * Competitor domains that appear in AI responses when user's brand is NOT mentioned.
     */
    async getSourceOpportunities(projectId: string) {
      const checks = await db.query.visibilityChecks.findMany({
        where: and(
          eq(visibilityChecks.projectId, projectId),
          eq(visibilityChecks.brandMentioned, false),
        ),
      });

      const competitorData = new Map<
        string,
        { count: number; queries: Set<string> }
      >();
      for (const check of checks) {
        const mentions = (check.competitorMentions ?? []) as Array<{
          domain: string;
          mentioned: boolean;
        }>;
        for (const m of mentions) {
          if (m.mentioned) {
            const existing = competitorData.get(m.domain) ?? {
              count: 0,
              queries: new Set<string>(),
            };
            existing.count++;
            existing.queries.add(check.query);
            competitorData.set(m.domain, existing);
          }
        }
      }

      return Array.from(competitorData.entries())
        .map(([domain, data]) => ({
          domain,
          mentionCount: data.count,
          queries: Array.from(data.queries),
        }))
        .sort((a, b) => b.mentionCount - a.mentionCount);
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
        .orderBy(sql`date_trunc('week', ${visibilityChecks.checkedAt})`)
        .limit(52);

      return rows.map((r) => ({
        weekStart: r.weekStart,
        provider: r.provider,
        mentionRate: Number(r.mentionRate),
        citationRate: Number(r.citationRate),
        totalChecks: Number(r.totalChecks),
      }));
    },

    /**
     * Get sentiment breakdown for a project: distribution + per-provider stats.
     */
    async getSentimentSummary(projectId: string) {
      const checks = await db
        .select({
          sentiment: visibilityChecks.sentiment,
          brandDescription: visibilityChecks.brandDescription,
          llmProvider: visibilityChecks.llmProvider,
          checkedAt: visibilityChecks.checkedAt,
        })
        .from(visibilityChecks)
        .where(
          and(
            eq(visibilityChecks.projectId, projectId),
            eq(visibilityChecks.brandMentioned, true),
            isNotNull(visibilityChecks.sentiment),
          ),
        )
        .orderBy(desc(visibilityChecks.checkedAt))
        .limit(200);
      return checks;
    },

    async countSince(projectId: string, since: Date) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(visibilityChecks)
        .where(
          and(
            eq(visibilityChecks.projectId, projectId),
            sql`${visibilityChecks.checkedAt} >= ${since.toISOString()}`,
          ),
        );
      return row?.count ?? 0;
    },
  };
}
