import { eq, desc, count } from "drizzle-orm";
import type { Database } from "../client";
import { actionItems } from "../schema";

export type ActionItemStatus =
  | "pending"
  | "in_progress"
  | "fixed"
  | "dismissed";

export function actionItemQueries(db: Database) {
  return {
    async listByProject(projectId: string) {
      return db.query.actionItems.findMany({
        where: eq(actionItems.projectId, projectId),
        orderBy: [desc(actionItems.createdAt)],
      });
    },

    async getById(id: string) {
      return db.query.actionItems.findFirst({
        where: eq(actionItems.id, id),
      });
    },

    async updateStatus(id: string, status: ActionItemStatus) {
      const [updated] = await db
        .update(actionItems)
        .set({ status, updatedAt: new Date() })
        .where(eq(actionItems.id, id))
        .returning();
      return updated;
    },

    async getStats(projectId: string) {
      const rows = await db
        .select({
          status: actionItems.status,
          count: count(),
        })
        .from(actionItems)
        .where(eq(actionItems.projectId, projectId))
        .groupBy(actionItems.status);

      let total = 0;
      let fixed = 0;
      let inProgress = 0;
      let dismissed = 0;
      let pending = 0;

      for (const row of rows) {
        const n = Number(row.count);
        total += n;
        if (row.status === "fixed") fixed = n;
        else if (row.status === "in_progress") inProgress = n;
        else if (row.status === "dismissed") dismissed = n;
        else if (row.status === "pending") pending = n;
      }

      const fixRate = total > 0 ? Math.round((fixed / total) * 100) : 0;

      return { total, fixed, inProgress, dismissed, pending, fixRate };
    },
  };
}
