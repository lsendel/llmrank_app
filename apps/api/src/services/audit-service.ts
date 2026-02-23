import { auditLogWriteQueries, outboxQueries } from "@llm-boost/db";
import type { Database } from "@llm-boost/db";

export interface AuditEvent {
  action: string;
  actorId: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  orgId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export function createAuditService(db: Database) {
  const audit = auditLogWriteQueries(db);
  const outbox = outboxQueries(db);

  return {
    async emitEvent(event: AuditEvent) {
      await audit.create({
        action: event.action,
        actorId: event.actorId,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        metadata: event.metadata,
        orgId: event.orgId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      });

      try {
        await outbox.enqueue({
          type: `audit.${event.action}`,
          payload: {
            action: event.action,
            actorId: event.actorId,
            resourceType: event.resourceType,
            resourceId: event.resourceId,
            metadata: event.metadata,
          },
        });
      } catch {
        // Outbox failure should not block the primary action
      }
    },
  };
}
