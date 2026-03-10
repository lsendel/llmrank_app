import { Bell, Globe, Hash, Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  NotificationChannel,
  NotificationChannelType,
  NotificationEventType,
} from "@/lib/api";
import {
  NOTIFICATION_EVENT_OPTIONS,
  getNotificationChannelConfigDisplay,
  getNotificationChannelConfigLabel,
  getNotificationChannelConfigPlaceholder,
  getNotificationChannelTypeLabel,
} from "./notification-channels-section-helpers";

const CHANNEL_TYPE_ICONS = {
  email: Mail,
  webhook: Globe,
  slack_incoming: Hash,
} satisfies Record<NotificationChannelType, typeof Mail>;

type NotificationChannelsIntroProps = {
  channelCount: number;
  maxChannels: number;
  addChannelOpen: boolean;
  channelType: NotificationChannelType;
  channelConfigValue: string;
  channelEventTypes: NotificationEventType[];
  savingChannel: boolean;
  channelError: string | null;
  onAddChannelOpenChange: (open: boolean) => void;
  onChannelTypeChange: (value: NotificationChannelType) => void;
  onChannelConfigValueChange: (value: string) => void;
  onToggleEventType: (eventType: NotificationEventType) => void;
  onCreateChannel: () => void | Promise<void>;
};

type NotificationChannelsListProps = {
  channels: NotificationChannel[];
  deletingChannelId: string | null;
  togglingChannelId: string | null;
  onToggleChannel: (channel: NotificationChannel) => void | Promise<void>;
  onDeleteChannel: (id: string) => void | Promise<void>;
};

export function NotificationChannelsIntro({
  channelCount,
  maxChannels,
  addChannelOpen,
  channelType,
  channelConfigValue,
  channelEventTypes,
  savingChannel,
  channelError,
  onAddChannelOpenChange,
  onChannelTypeChange,
  onChannelConfigValueChange,
  onToggleEventType,
  onCreateChannel,
}: NotificationChannelsIntroProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">Notification Channels</h2>
        <p className="text-sm text-muted-foreground">
          Configure where you receive alerts about crawls, score changes, and
          visibility events.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="secondary">
          {channelCount} / {maxChannels} channels
        </Badge>
        <Dialog open={addChannelOpen} onOpenChange={onAddChannelOpenChange}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={channelCount >= maxChannels}>
              <Plus className="h-4 w-4" />
              Add Channel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Notification Channel</DialogTitle>
              <DialogDescription>
                Choose a channel type and configure where to send alerts.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Channel Type</Label>
                <Select
                  value={channelType}
                  onValueChange={(value) =>
                    onChannelTypeChange(value as NotificationChannelType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="slack_incoming">
                      Slack Incoming Webhook
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{getNotificationChannelConfigLabel(channelType)}</Label>
                <Input
                  placeholder={getNotificationChannelConfigPlaceholder(
                    channelType,
                  )}
                  value={channelConfigValue}
                  onChange={(event) =>
                    onChannelConfigValueChange(event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Event Types</Label>
                <div className="space-y-2">
                  {NOTIFICATION_EVENT_OPTIONS.map((eventOption) => (
                    <label
                      key={eventOption.value}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={channelEventTypes.includes(eventOption.value)}
                        onChange={() => onToggleEventType(eventOption.value)}
                        className="rounded border-input"
                      />
                      {eventOption.label}
                    </label>
                  ))}
                </div>
              </div>

              {channelError && (
                <p className="text-sm text-destructive">{channelError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onAddChannelOpenChange(false)}
              >
                Cancel
              </Button>
              <Button onClick={onCreateChannel} disabled={savingChannel}>
                {savingChannel ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Channel"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export function NotificationChannelsEmptyState() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Bell className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">
          No notification channels configured yet. Add one to start receiving
          alerts.
        </p>
      </CardContent>
    </Card>
  );
}

export function NotificationChannelsList({
  channels,
  deletingChannelId,
  togglingChannelId,
  onToggleChannel,
  onDeleteChannel,
}: NotificationChannelsListProps) {
  return (
    <div className="space-y-3">
      {channels.map((channel) => {
        const configDisplay = getNotificationChannelConfigDisplay(channel);
        const typeLabel = getNotificationChannelTypeLabel(channel.type);
        const TypeIcon = CHANNEL_TYPE_ICONS[channel.type];

        return (
          <Card key={channel.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="min-w-0 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <TypeIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {typeLabel}
                    </Badge>
                    {!channel.enabled && (
                      <Badge variant="secondary" className="text-xs">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {configDisplay}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {channel.eventTypes.map((eventType) => (
                      <Badge
                        key={eventType}
                        variant="secondary"
                        className="text-xs font-normal"
                      >
                        {eventType.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="ml-4 flex flex-shrink-0 items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-label={`Toggle ${configDisplay}`}
                  aria-checked={channel.enabled}
                  disabled={togglingChannelId === channel.id}
                  onClick={() => onToggleChannel(channel)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    channel.enabled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      channel.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${configDisplay}`}
                  disabled={deletingChannelId === channel.id}
                  onClick={() => onDeleteChannel(channel.id)}
                >
                  {deletingChannelId === channel.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
