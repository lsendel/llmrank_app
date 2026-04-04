import { eq, desc, and, gte, sql } from "drizzle-orm";
import type { AdminDatabase as Database } from "../d1-client";
import { auditLogs } from "../schema";

export function auditLogWriteQueries(db: Database) {
  return {
    async create(data: {
      actorId: string;
      action: string;
      resourceType: string;
      resourceId?: string;
      metadata?: Record<string, unknown>;
      orgId?: string;
      ipAddress?: string;
      userAgent?: string;
    }) {
      const [log] = await db
        .insert(auditLogs)
        .values({
          ...data,
          id: crypto.randomUUID(),
          metadata:
            data.metadata != null ? JSON.stringify(data.metadata) : undefined,
        })
        .returning();
      return log;
    },

    async listByActor(actorId: string, limit = 50) {
      return db.query.auditLogs.findMany({
        where: eq(auditLogs.actorId, actorId),
        orderBy: desc(auditLogs.createdAt),
        limit,
      });
    },

    async listByResource(resourceType: string, resourceId: string, limit = 50) {
      return db.query.auditLogs.findMany({
        where: and(
          eq(auditLogs.resourceType, resourceType),
          eq(auditLogs.resourceId, resourceId),
        ),
        orderBy: desc(auditLogs.createdAt),
        limit,
      });
    },

    async countByActionSince(action: string, since: Date) {
      const rows = await db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, action),
            gte(auditLogs.createdAt, since.toISOString()),
          ),
        );
      return rows[0]?.count ?? 0;
    },
  };
}
