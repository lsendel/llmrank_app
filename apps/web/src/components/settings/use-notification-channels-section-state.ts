import { useCallback, useState } from "react";
import {
  api,
  type BillingInfo,
  type NotificationChannel,
  type NotificationChannelType,
  type NotificationEventType,
} from "@/lib/api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  getMaxNotificationChannels,
  getNotificationChannelConfigKey,
  toggleNotificationEventType,
  validateNotificationChannelDraft,
} from "./notification-channels-section-helpers";

export function useNotificationChannelsSectionState() {
  const { data: billing } = useApiSWR<BillingInfo>(
    "billing-info",
    useCallback(() => api.billing.getInfo(), []),
  );
  const { data: channels, mutate: mutateChannels } = useApiSWR<
    NotificationChannel[]
  >(
    "notification-channels",
    useCallback(() => api.channels.list(), []),
  );

  const [addChannelOpen, setAddChannelOpen] = useState(false);
  const [channelType, setChannelType] =
    useState<NotificationChannelType>("email");
  const [channelConfigValue, setChannelConfigValue] = useState("");
  const [channelEventTypes, setChannelEventTypes] = useState<
    NotificationEventType[]
  >(["crawl_completed"]);
  const [savingChannel, setSavingChannel] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(
    null,
  );
  const [togglingChannelId, setTogglingChannelId] = useState<string | null>(
    null,
  );

  const channelList = channels ?? [];
  const maxChannels = getMaxNotificationChannels(billing?.plan);

  const handleAddChannelOpenChange = useCallback((open: boolean) => {
    setAddChannelOpen(open);
  }, []);

  const handleChannelTypeChange = useCallback(
    (value: NotificationChannelType) => {
      setChannelType(value);
    },
    [],
  );

  const handleChannelConfigValueChange = useCallback((value: string) => {
    setChannelConfigValue(value);
    setChannelError(null);
  }, []);

  const handleToggleEventType = useCallback(
    (eventType: NotificationEventType) => {
      setChannelEventTypes((current) =>
        toggleNotificationEventType(current, eventType),
      );
    },
    [],
  );

  const handleCreateChannel = useCallback(async () => {
    setChannelError(null);

    const validationError = validateNotificationChannelDraft(
      channelType,
      channelConfigValue,
      channelEventTypes,
    );

    if (validationError) {
      setChannelError(validationError);
      return;
    }

    setSavingChannel(true);
    try {
      const configKey = getNotificationChannelConfigKey(channelType);
      await api.channels.create({
        type: channelType,
        config: { [configKey]: channelConfigValue.trim() },
        eventTypes: channelEventTypes,
      });
      await mutateChannels?.();
      setAddChannelOpen(false);
      setChannelConfigValue("");
      setChannelType("email");
      setChannelEventTypes(["crawl_completed"]);
    } catch (error) {
      setChannelError(
        error instanceof Error ? error.message : "Failed to create channel",
      );
    } finally {
      setSavingChannel(false);
    }
  }, [channelConfigValue, channelEventTypes, channelType, mutateChannels]);

  const handleToggleChannel = useCallback(
    async (channel: NotificationChannel) => {
      setTogglingChannelId(channel.id);
      try {
        await api.channels.update(channel.id, { enabled: !channel.enabled });
        await mutateChannels?.();
      } catch (error) {
        console.error("Failed to toggle channel:", error);
      } finally {
        setTogglingChannelId(null);
      }
    },
    [mutateChannels],
  );

  const handleDeleteChannel = useCallback(
    async (id: string) => {
      setDeletingChannelId(id);
      try {
        await api.channels.delete(id);
        await mutateChannels?.();
      } catch (error) {
        console.error("Failed to delete channel:", error);
      } finally {
        setDeletingChannelId(null);
      }
    },
    [mutateChannels],
  );

  return {
    addChannelOpen,
    channelType,
    channelConfigValue,
    channelEventTypes,
    savingChannel,
    channelError,
    deletingChannelId,
    togglingChannelId,
    channels: channelList,
    maxChannels,
    handleAddChannelOpenChange,
    handleChannelTypeChange,
    handleChannelConfigValueChange,
    handleToggleEventType,
    handleCreateChannel,
    handleToggleChannel,
    handleDeleteChannel,
  };
}
