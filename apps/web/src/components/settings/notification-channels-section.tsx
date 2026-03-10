"use client";

import {
  NotificationChannelsEmptyState,
  NotificationChannelsIntro,
  NotificationChannelsList,
} from "./notification-channels-section-sections";
import { useNotificationChannelsSectionState } from "./use-notification-channels-section-state";

export function NotificationChannelsSection() {
  const state = useNotificationChannelsSectionState();

  return (
    <div className="space-y-6 pt-4">
      <NotificationChannelsIntro
        channelCount={state.channels.length}
        maxChannels={state.maxChannels}
        addChannelOpen={state.addChannelOpen}
        channelType={state.channelType}
        channelConfigValue={state.channelConfigValue}
        channelEventTypes={state.channelEventTypes}
        savingChannel={state.savingChannel}
        channelError={state.channelError}
        onAddChannelOpenChange={state.handleAddChannelOpenChange}
        onChannelTypeChange={state.handleChannelTypeChange}
        onChannelConfigValueChange={state.handleChannelConfigValueChange}
        onToggleEventType={state.handleToggleEventType}
        onCreateChannel={state.handleCreateChannel}
      />

      {state.channels.length === 0 ? (
        <NotificationChannelsEmptyState />
      ) : (
        <NotificationChannelsList
          channels={state.channels}
          deletingChannelId={state.deletingChannelId}
          togglingChannelId={state.togglingChannelId}
          onToggleChannel={state.handleToggleChannel}
          onDeleteChannel={state.handleDeleteChannel}
        />
      )}
    </div>
  );
}
