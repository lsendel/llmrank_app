export type NotificationChannelType = "email" | "webhook" | "slack_incoming";

export type NotificationEventType =
  | "crawl_completed"
  | "score_drop"
  | "mention_gained"
  | "mention_lost"
  | "position_changed";

export interface NotificationChannel {
  id: string;
  userId: string;
  type: NotificationChannelType;
  config: Record<string, string>;
  eventTypes: NotificationEventType[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChannelInput {
  type: NotificationChannelType;
  config: Record<string, string>;
  eventTypes: NotificationEventType[];
}

export interface ChannelUpdate {
  enabled: boolean;
  config: Record<string, string>;
  eventTypes: NotificationEventType[];
}
