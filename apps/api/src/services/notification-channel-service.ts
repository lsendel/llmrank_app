import { PLAN_LIMITS } from "@llm-boost/shared";
import { ServiceError } from "./errors";

type ChannelType = "email" | "webhook" | "slack_incoming" | "slack_app";

interface CreateChannelInput {
  userId: string;
  projectId?: string;
  channelType: ChannelType;
  config: Record<string, unknown>;
  eventTypes: string[];
}

interface NotificationChannelServiceDeps {
  channels: {
    create(data: CreateChannelInput): Promise<any>;
    listByUser(userId: string): Promise<any[]>;
    getById(id: string): Promise<any>;
    update(id: string, data: any): Promise<any>;
    delete(id: string): Promise<void>;
    countByUser(userId: string): Promise<number>;
  };
  users: {
    getById(
      id: string,
    ): Promise<{ id: string; plan: string; email: string } | null>;
  };
}

export function createNotificationChannelService(
  deps: NotificationChannelServiceDeps,
) {
  return {
    async create(args: CreateChannelInput) {
      const user = await deps.users.getById(args.userId);
      if (!user) throw new ServiceError("NOT_FOUND", 404, "User not found");

      const limits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS];

      // Free tier: email only
      if (user.plan === "free" && args.channelType !== "email") {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "PLAN_LIMIT_REACHED: Free tier only supports email notifications",
        );
      }

      const count = await deps.channels.countByUser(args.userId);
      if (count >= limits.notificationChannels) {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          `PLAN_LIMIT_REACHED: Plan limit of ${limits.notificationChannels} channels reached`,
        );
      }

      return deps.channels.create(args);
    },

    async list(userId: string) {
      return deps.channels.listByUser(userId);
    },

    async update(userId: string, channelId: string, data: any) {
      const channel = await deps.channels.getById(channelId);
      if (!channel || channel.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Channel not found");
      }
      return deps.channels.update(channelId, data);
    },

    async delete(userId: string, channelId: string) {
      const channel = await deps.channels.getById(channelId);
      if (!channel || channel.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Channel not found");
      }
      await deps.channels.delete(channelId);
    },
  };
}
