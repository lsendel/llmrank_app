import type { Database } from "@llm-boost/db";
import { auditLogQueries } from "@llm-boost/db";

export async function logAudit(
  db: Database,
  data: {
    orgId?: string;
    actorId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  },
) {
  const q = auditLogQueries(db);
  await q.create({
    orgId: data.orgId ?? undefined,
    actorId: data.actorId,
    action: data.action,
    resourceType: data.resourceType ?? undefined,
    resourceId: data.resourceId ?? undefined,
    metadata: data.metadata ?? {},
    ipAddress: data.ipAddress ?? undefined,
  });
}
