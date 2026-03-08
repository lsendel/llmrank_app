import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type {
  ChannelUpdate,
  CreateChannelInput,
  NotificationChannel,
} from "../types/channels";

export function createChannelsApi() {
  return {
    async list(): Promise<NotificationChannel[]> {
      const res = await apiClient.get<ApiEnvelope<NotificationChannel[]>>(
        "/api/notification-channels",
      );
      return res.data;
    },

    async create(data: CreateChannelInput): Promise<NotificationChannel> {
      const res = await apiClient.post<ApiEnvelope<NotificationChannel>>(
        "/api/notification-channels",
        data,
      );
      return res.data;
    },

    async update(
      id: string,
      data: Partial<ChannelUpdate>,
    ): Promise<NotificationChannel> {
      const res = await apiClient.patch<ApiEnvelope<NotificationChannel>>(
        `/api/notification-channels/${id}`,
        data,
      );
      return res.data;
    },

    async delete(id: string): Promise<void> {
      await apiClient.delete(`/api/notification-channels/${id}`);
    },
  };
}
