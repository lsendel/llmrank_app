import { eq, and, isNull, desc } from "drizzle-orm";
import type { Database } from "../client";
import { alerts } from "../schema";

export function alertQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      type: string;
      severity: "critical" | "warning" | "info";
      message: string;
      data?: unknown;
    }) {
      const [alert] = await db.insert(alerts).values(data).returning();
      return alert;
    },

    async listUnacknowledged(projectId: string) {
      return db.query.alerts.findMany({
        where: and(
          eq(alerts.projectId, projectId),
          isNull(alerts.acknowledgedAt),
        ),
        orderBy: [desc(alerts.createdAt)],
      });
    },

    async acknowledge(id: string) {
      const [updated] = await db
        .update(alerts)
        .set({ acknowledgedAt: new Date() })
        .where(eq(alerts.id, id))
        .returning();
      return updated;
    },

    async acknowledgeAll(projectId: string) {
      await db
        .update(alerts)
        .set({ acknowledgedAt: new Date() })
        .where(
          and(eq(alerts.projectId, projectId), isNull(alerts.acknowledgedAt)),
        );
    },
  };
}
