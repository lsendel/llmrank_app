import { eq, and, desc, gte, sql } from "drizzle-orm";
import type { Database } from "../client";
import { competitorEvents } from "../schema";
import type { competitorEventTypeEnum, alertSeverityEnum } from "../schema";

type CompetitorEventType = (typeof competitorEventTypeEnum.enumValues)[number];
type AlertSeverity = (typeof alertSeverityEnum.enumValues)[number];

export function competitorEventQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      competitorDomain: string;
      eventType: CompetitorEventType;
      severity: AlertSeverity;
      summary: string;
      data?: Record<string, unknown>;
      benchmarkId?: string;
    }) {
      const [event] = await db
        .insert(competitorEvents)
        .values(data)
        .returning();
      return event;
    },

    async listByProject(
      projectId: string,
      opts: {
        limit?: number;
        offset?: number;
        eventType?: string;
        severity?: string;
        domain?: string;
        since?: Date;
      } = {},
    ) {
      const {
        limit = 20,
        offset = 0,
        eventType,
        severity,
        domain,
        since,
      } = opts;
      const conditions = [eq(competitorEvents.projectId, projectId)];

      if (eventType)
        conditions.push(eq(competitorEvents.eventType, eventType as any));
      if (severity)
        conditions.push(eq(competitorEvents.severity, severity as any));
      if (domain)
        conditions.push(eq(competitorEvents.competitorDomain, domain));
      if (since) conditions.push(gte(competitorEvents.createdAt, since));

      return db.query.competitorEvents.findMany({
        where: and(...conditions),
        orderBy: [desc(competitorEvents.createdAt)],
        limit,
        offset,
      });
    },

    async countByProject(projectId: string) {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(competitorEvents)
        .where(eq(competitorEvents.projectId, projectId));
      return result?.count ?? 0;
    },

    async listByDomain(projectId: string, domain: string, limit = 20) {
      return db.query.competitorEvents.findMany({
        where: and(
          eq(competitorEvents.projectId, projectId),
          eq(competitorEvents.competitorDomain, domain),
        ),
        orderBy: [desc(competitorEvents.createdAt)],
        limit,
      });
    },
  };
}
