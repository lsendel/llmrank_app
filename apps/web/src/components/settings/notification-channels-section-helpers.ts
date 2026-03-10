import type {
  BillingInfo,
  NotificationChannel,
  NotificationChannelType,
  NotificationEventType,
} from "@/lib/api";

export const NOTIFICATION_CHANNEL_LIMITS: Record<BillingInfo["plan"], number> =
  {
    free: 1,
    starter: 3,
    pro: 10,
    agency: 25,
  };

export const NOTIFICATION_EVENT_OPTIONS: {
  value: NotificationEventType;
  label: string;
}[] = [
  { value: "crawl_completed", label: "Crawl Completed" },
  { value: "score_drop", label: "Score Drop" },
  { value: "mention_gained", label: "Mention Gained" },
  { value: "mention_lost", label: "Mention Lost" },
  { value: "position_changed", label: "Position Changed" },
];

export function getMaxNotificationChannels(plan?: BillingInfo["plan"]) {
  return NOTIFICATION_CHANNEL_LIMITS[plan ?? "free"] ?? 1;
}

export function toggleNotificationEventType(
  eventTypes: NotificationEventType[],
  eventType: NotificationEventType,
) {
  return eventTypes.includes(eventType)
    ? eventTypes.filter((value) => value !== eventType)
    : [...eventTypes, eventType];
}

export function getNotificationChannelConfigKey(
  channelType: NotificationChannelType,
) {
  return channelType === "email" ? "email" : "url";
}

export function getNotificationChannelConfigLabel(
  channelType: NotificationChannelType,
) {
  if (channelType === "email") {
    return "Email Address";
  }

  return channelType === "slack_incoming" ? "Slack Webhook URL" : "Webhook URL";
}

export function getNotificationChannelConfigPlaceholder(
  channelType: NotificationChannelType,
) {
  if (channelType === "email") {
    return "alerts@example.com";
  }

  return channelType === "slack_incoming"
    ? "https://hooks.slack.com/services/..."
    : "https://api.example.com/webhook";
}

export function validateNotificationChannelDraft(
  channelType: NotificationChannelType,
  channelConfigValue: string,
  channelEventTypes: NotificationEventType[],
) {
  const value = channelConfigValue.trim();

  if (!value) {
    return "Please provide a value.";
  }

  if (channelType === "email" && !value.includes("@")) {
    return "Please enter a valid email address.";
  }

  if (
    (channelType === "webhook" || channelType === "slack_incoming") &&
    !value.startsWith("https://")
  ) {
    return "URL must start with https://";
  }

  if (channelEventTypes.length === 0) {
    return "Select at least one event type.";
  }

  return null;
}

export function getNotificationChannelTypeLabel(
  channelType: NotificationChannelType,
) {
  if (channelType === "email") {
    return "Email";
  }

  return channelType === "slack_incoming" ? "Slack" : "Webhook";
}

export function getNotificationChannelConfigDisplay(
  channel: NotificationChannel,
) {
  return channel.type === "email" ? channel.config.email : channel.config.url;
}
