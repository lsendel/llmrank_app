import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { notificationChannels } from "../schema";

export function notificationChannelQueries(db: Database) {
  return {
    async create(data: {
      userId: string;
      projectId?: string;
      channelType: "email" | "webhook" | "slack_incoming" | "slack_app";
      config: Record<string, unknown>;
      eventTypes: string[];
    }) {
      const [channel] = await db
        .insert(notificationChannels)
        .values({
          userId: data.userId,
          projectId: data.projectId ?? null,
          channelType: data.channelType,
          config: data.config,
          eventTypes: data.eventTypes,
        })
        .returning();
      return channel;
    },

    async listByUser(userId: string) {
      return db
        .select()
        .from(notificationChannels)
        .where(eq(notificationChannels.userId, userId))
        .orderBy(notificationChannels.createdAt);
    },

    async getById(id: string) {
      const [channel] = await db
        .select()
        .from(notificationChannels)
        .where(eq(notificationChannels.id, id));
      return channel ?? null;
    },

    async update(
      id: string,
      data: Partial<{
        config: Record<string, unknown>;
        eventTypes: string[];
        enabled: boolean;
      }>,
    ) {
      const [updated] = await db
        .update(notificationChannels)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notificationChannels.id, id))
        .returning();
      return updated ?? null;
    },

    async delete(id: string) {
      await db
        .delete(notificationChannels)
        .where(eq(notificationChannels.id, id));
    },

    async countByUser(userId: string) {
      const rows = await db
        .select()
        .from(notificationChannels)
        .where(eq(notificationChannels.userId, userId));
      return rows.length;
    },

    async findByEventType(
      userId: string,
      eventType: string,
      projectId?: string,
    ) {
      const rows = await this.listByUser(userId);
      return rows.filter(
        (ch) =>
          ch.enabled &&
          ch.eventTypes.includes(eventType) &&
          (!ch.projectId || ch.projectId === projectId),
      );
    },
  };
}
