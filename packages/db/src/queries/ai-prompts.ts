import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "../client";
import { aiPrompts } from "../schema";

export function aiPromptQueries(db: Database) {
  return {
    async create(
      data: {
        projectId: string;
        prompt: string;
        category?: string | null;
        estimatedVolume?: number | null;
        difficulty?: number | null;
        intent?: string | null;
        yourMentioned?: boolean;
        competitorsMentioned?: unknown;
        source?: string;
      }[],
    ) {
      if (data.length === 0) return [];
      return db.insert(aiPrompts).values(data).returning();
    },

    async listByProject(
      projectId: string,
      opts?: { limit?: number; offset?: number },
    ) {
      return db.query.aiPrompts.findMany({
        where: eq(aiPrompts.projectId, projectId),
        orderBy: [desc(aiPrompts.estimatedVolume)],
        limit: opts?.limit ?? 100,
        offset: opts?.offset ?? 0,
      });
    },

    async countByProject(projectId: string) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiPrompts)
        .where(eq(aiPrompts.projectId, projectId));
      return row?.count ?? 0;
    },

    async deleteById(id: string, projectId: string) {
      return db
        .delete(aiPrompts)
        .where(and(eq(aiPrompts.id, id), eq(aiPrompts.projectId, projectId)));
    },

    async deleteAllByProject(projectId: string) {
      return db.delete(aiPrompts).where(eq(aiPrompts.projectId, projectId));
    },
  };
}
