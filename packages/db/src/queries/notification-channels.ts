import { eq } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
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
          id: crypto.randomUUID(),
          userId: data.userId,
          projectId: data.projectId ?? null,
          channelType: data.channelType,
          config: JSON.stringify(data.config),
          eventTypes: JSON.stringify(data.eventTypes),
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
      const setData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (data.config !== undefined)
        setData.config = JSON.stringify(data.config);
      if (data.eventTypes !== undefined)
        setData.eventTypes = JSON.stringify(data.eventTypes);
      if (data.enabled !== undefined) setData.enabled = data.enabled;
      const [updated] = await db
        .update(notificationChannels)
        .set(setData)
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
      return rows.filter((ch) => {
        const types: string[] =
          typeof ch.eventTypes === "string"
            ? JSON.parse(ch.eventTypes)
            : ch.eventTypes;
        return (
          ch.enabled &&
          types.includes(eventType) &&
          (!ch.projectId || ch.projectId === projectId)
        );
      });
    },
  };
}
