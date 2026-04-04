import { eq, and } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { reportSchedules } from "../schema";

export function reportScheduleQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      format: "pdf" | "docx";
      type: "summary" | "detailed";
      recipientEmail: string;
    }) {
      const [schedule] = await db
        .insert(reportSchedules)
        .values(data)
        .returning();
      return schedule;
    },

    async listByProject(projectId: string) {
      return db.query.reportSchedules.findMany({
        where: eq(reportSchedules.projectId, projectId),
      });
    },

    async getById(id: string) {
      return db.query.reportSchedules.findFirst({
        where: eq(reportSchedules.id, id),
      });
    },

    async getActiveByProject(projectId: string) {
      return db.query.reportSchedules.findMany({
        where: and(
          eq(reportSchedules.projectId, projectId),
          eq(reportSchedules.enabled, true),
        ),
      });
    },

    async update(
      id: string,
      data: Partial<{
        format: "pdf" | "docx";
        type: "summary" | "detailed";
        recipientEmail: string;
        enabled: boolean;
      }>,
    ) {
      const [updated] = await db
        .update(reportSchedules)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(reportSchedules.id, id))
        .returning();
      return updated;
    },

    async delete(id: string) {
      await db.delete(reportSchedules).where(eq(reportSchedules.id, id));
    },
  };
}
