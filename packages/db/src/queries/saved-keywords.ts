import { eq, desc, sql, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { savedKeywords } from "../schema";

export function savedKeywordQueries(db: Database) {
  return {
    async listByProject(projectId: string) {
      return db.query.savedKeywords.findMany({
        where: eq(savedKeywords.projectId, projectId),
        orderBy: [desc(savedKeywords.createdAt)],
      });
    },

    async create(data: {
      projectId: string;
      keyword: string;
      source?: "auto_discovered" | "user_added" | "perplexity";
      relevanceScore?: number;
      funnelStage?: "education" | "comparison" | "purchase";
      personaId?: string;
    }) {
      const [kw] = await db.insert(savedKeywords).values(data).returning();
      return kw;
    },

    async createMany(
      rows: Array<{
        projectId: string;
        keyword: string;
        source?: "auto_discovered" | "user_added" | "perplexity";
        relevanceScore?: number;
        funnelStage?: "education" | "comparison" | "purchase";
        personaId?: string;
      }>,
    ) {
      if (rows.length === 0) return [];
      return db.insert(savedKeywords).values(rows).returning();
    },

    async remove(id: string) {
      const [deleted] = await db
        .delete(savedKeywords)
        .where(eq(savedKeywords.id, id))
        .returning();
      return deleted;
    },

    async countByProject(projectId: string) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(savedKeywords)
        .where(eq(savedKeywords.projectId, projectId));
      return row?.count ?? 0;
    },

    async countByProjects(projectIds: string[]) {
      if (projectIds.length === 0) return new Map<string, number>();
      const rows = await db
        .select({
          projectId: savedKeywords.projectId,
          count: sql<number>`count(*)::int`,
        })
        .from(savedKeywords)
        .where(inArray(savedKeywords.projectId, projectIds))
        .groupBy(savedKeywords.projectId);

      return new Map(rows.map((r) => [r.projectId, r.count]));
    },
  };
}
