import { eq, sql } from "drizzle-orm";
import type { Database } from "../client";
import { outboxEvents, eventStatusEnum } from "../schema";

export type EventStatus = (typeof eventStatusEnum.enumValues)[number];

export interface OutboxEventData {
  type: string;
  payload: Record<string, unknown>;
  availableAt?: Date;
}

export function outboxQueries(db: Database) {
  return {
    async enqueue(event: OutboxEventData) {
      const [row] = await db
        .insert(outboxEvents)
        .values({
          type: event.type,
          payload: event.payload,
          availableAt: event.availableAt ?? new Date(),
        })
        .returning();
      return row;
    },

    async claimBatch(limit = 10) {
      const rows = await db
        .update(outboxEvents)
        .set({ status: "processing" })
        .where(
          sql`${outboxEvents.id} IN (
            SELECT id FROM ${outboxEvents}
            WHERE ${outboxEvents.status} = 'pending'
              AND ${outboxEvents.availableAt} <= NOW()
            ORDER BY ${outboxEvents.availableAt}
            FOR UPDATE SKIP LOCKED
            LIMIT ${limit}
          )`,
        )
        .returning();
      return rows;
    },

    async markCompleted(id: string) {
      await db
        .update(outboxEvents)
        .set({ status: "completed", processedAt: new Date() })
        .where(eq(outboxEvents.id, id));
    },

    async markFailed(id: string, retryDelaySeconds = 60) {
      await db
        .update(outboxEvents)
        .set({
          status: "pending",
          attempts: sql`${outboxEvents.attempts} + 1`,
          availableAt: sql`NOW() + interval '${retryDelaySeconds} seconds'`,
        })
        .where(eq(outboxEvents.id, id));
    },
  };
}
