import { eq, and, isNull, desc } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
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
      const [alert] = await db
        .insert(alerts)
        .values({
          ...data,
          id: crypto.randomUUID(),
          data:
            data.data != null
              ? typeof data.data === "string"
                ? data.data
                : JSON.stringify(data.data)
              : undefined,
        })
        .returning();
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
        .set({ acknowledgedAt: new Date().toISOString() })
        .where(eq(alerts.id, id))
        .returning();
      return updated;
    },

    async acknowledgeAll(projectId: string) {
      await db
        .update(alerts)
        .set({ acknowledgedAt: new Date().toISOString() })
        .where(
          and(eq(alerts.projectId, projectId), isNull(alerts.acknowledgedAt)),
        );
    },
  };
}
