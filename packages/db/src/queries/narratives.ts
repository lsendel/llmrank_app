import { eq, and, desc, sql } from "drizzle-orm";
import type { AgencyDatabase as Database } from "../supabase-client";
import { narrativeReports } from "../schema";

export function narrativeQueries(db: Database) {
  return {
    async create(data: typeof narrativeReports.$inferInsert) {
      const [row] = await db.insert(narrativeReports).values(data).returning();
      return row;
    },

    async getByCrawlAndTone(crawlJobId: string, tone: string) {
      const rows = await db
        .select()
        .from(narrativeReports)
        .where(
          and(
            eq(narrativeReports.crawlJobId, crawlJobId),
            eq(narrativeReports.tone, tone as "technical" | "business"),
          ),
        )
        .orderBy(desc(narrativeReports.version))
        .limit(1);
      return rows[0] ?? undefined;
    },

    async getById(id: string) {
      const rows = await db
        .select()
        .from(narrativeReports)
        .where(eq(narrativeReports.id, id))
        .limit(1);
      return rows[0] ?? undefined;
    },

    async listByProject(projectId: string, limit = 20) {
      return db
        .select()
        .from(narrativeReports)
        .where(eq(narrativeReports.projectId, projectId))
        .orderBy(desc(narrativeReports.createdAt))
        .limit(limit);
    },

    async updateStatus(
      id: string,
      status: "pending" | "generating" | "ready" | "failed",
      extra?: Partial<typeof narrativeReports.$inferInsert>,
    ) {
      const [row] = await db
        .update(narrativeReports)
        .set({ status, updatedAt: new Date(), ...extra })
        .where(eq(narrativeReports.id, id))
        .returning();
      return row;
    },

    async updateSections(id: string, sections: unknown[]) {
      const [row] = await db
        .update(narrativeReports)
        .set({ sections, updatedAt: new Date() })
        .where(eq(narrativeReports.id, id))
        .returning();
      return row;
    },

    async getLatestVersion(crawlJobId: string, tone: string) {
      const rows = await db
        .select({
          maxVersion: sql<number>`coalesce(max(${narrativeReports.version}), 0)`,
        })
        .from(narrativeReports)
        .where(
          and(
            eq(narrativeReports.crawlJobId, crawlJobId),
            eq(narrativeReports.tone, tone as "technical" | "business"),
          ),
        );
      return rows[0]?.maxVersion ?? 0;
    },

    async delete(id: string) {
      await db.delete(narrativeReports).where(eq(narrativeReports.id, id));
    },
  };
}
