import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  NotificationChannelsEmptyState,
  NotificationChannelsIntro,
  NotificationChannelsList,
} from "./notification-channels-section-sections";

describe("notification channels section sections", () => {
  it("renders the intro dialog and empty state", () => {
    const onOpenChange = vi.fn();
    const onConfigChange = vi.fn();
    const onToggleEventType = vi.fn();
    const onCreateChannel = vi.fn();

    render(
      <>
        <NotificationChannelsIntro
          channelCount={1}
          maxChannels={3}
          addChannelOpen={true}
          channelType="email"
          channelConfigValue="alerts@example.com"
          channelEventTypes={["crawl_completed"]}
          savingChannel={false}
          channelError="Please provide a value."
          onAddChannelOpenChange={onOpenChange}
          onChannelTypeChange={vi.fn()}
          onChannelConfigValueChange={onConfigChange}
          onToggleEventType={onToggleEventType}
          onCreateChannel={onCreateChannel}
        />
        <NotificationChannelsEmptyState />
      </>,
    );

    expect(screen.getByText("1 / 3 channels")).toBeInTheDocument();
    expect(screen.getByText("Add Notification Channel")).toBeInTheDocument();
    expect(
      screen.getByText(/No notification channels configured yet/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("alerts@example.com"), {
      target: { value: "ops@example.com" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Crawl Completed/i }));
    fireEvent.click(screen.getByRole("button", { name: "Create Channel" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfigChange).toHaveBeenCalledWith("ops@example.com");
    expect(onToggleEventType).toHaveBeenCalledWith("crawl_completed");
    expect(onCreateChannel).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders channels and forwards toggle and delete actions", () => {
    const onToggleChannel = vi.fn();
    const onDeleteChannel = vi.fn();

    render(
      <NotificationChannelsList
        channels={[
          {
            id: "channel-1",
            userId: "user-1",
            type: "email",
            config: { email: "alerts@example.com" },
            eventTypes: ["crawl_completed", "score_drop"],
            enabled: false,
            createdAt: "2026-03-07T12:00:00.000Z",
            updatedAt: "2026-03-07T12:00:00.000Z",
          },
        ]}
        deletingChannelId={null}
        togglingChannelId={null}
        onToggleChannel={onToggleChannel}
        onDeleteChannel={onDeleteChannel}
      />,
    );

    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByText("alerts@example.com")).toBeInTheDocument();
    expect(screen.getByText("crawl completed")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("switch", { name: /Toggle alerts@example.com/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Delete alerts@example.com/i }),
    );

    expect(onToggleChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: "channel-1" }),
    );
    expect(onDeleteChannel).toHaveBeenCalledWith("channel-1");
  });
});
