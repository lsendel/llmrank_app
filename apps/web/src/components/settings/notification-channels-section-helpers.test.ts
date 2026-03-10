import { describe, expect, it } from "vitest";
import {
  getMaxNotificationChannels,
  getNotificationChannelConfigDisplay,
  getNotificationChannelConfigKey,
  getNotificationChannelConfigLabel,
  getNotificationChannelConfigPlaceholder,
  getNotificationChannelTypeLabel,
  toggleNotificationEventType,
  validateNotificationChannelDraft,
} from "./notification-channels-section-helpers";

describe("notification channels section helpers", () => {
  it("derives plan limits and channel metadata", () => {
    expect(getMaxNotificationChannels("free")).toBe(1);
    expect(getMaxNotificationChannels("pro")).toBe(10);
    expect(getNotificationChannelConfigKey("email")).toBe("email");
    expect(getNotificationChannelConfigKey("webhook")).toBe("url");
    expect(getNotificationChannelConfigLabel("slack_incoming")).toBe(
      "Slack Webhook URL",
    );
    expect(getNotificationChannelConfigPlaceholder("webhook")).toContain(
      "https://",
    );
    expect(getNotificationChannelTypeLabel("slack_incoming")).toBe("Slack");
  });

  it("toggles event types and validates drafts", () => {
    expect(
      toggleNotificationEventType(["crawl_completed"], "score_drop"),
    ).toEqual(["crawl_completed", "score_drop"]);
    expect(
      toggleNotificationEventType(
        ["crawl_completed", "score_drop"],
        "score_drop",
      ),
    ).toEqual(["crawl_completed"]);

    expect(validateNotificationChannelDraft("email", "", [])).toBe(
      "Please provide a value.",
    );
    expect(
      validateNotificationChannelDraft("email", "alerts.example.com", [
        "crawl_completed",
      ]),
    ).toBe("Please enter a valid email address.");
    expect(
      validateNotificationChannelDraft("webhook", "http://hook.example.com", [
        "crawl_completed",
      ]),
    ).toBe("URL must start with https://");
    expect(
      validateNotificationChannelDraft("email", "alerts@example.com", []),
    ).toBe("Select at least one event type.");
    expect(
      validateNotificationChannelDraft("email", "alerts@example.com", [
        "crawl_completed",
      ]),
    ).toBeNull();
  });

  it("formats display values from channels", () => {
    expect(
      getNotificationChannelConfigDisplay({
        id: "channel-1",
        userId: "user-1",
        type: "email",
        config: { email: "alerts@example.com" },
        eventTypes: ["crawl_completed"],
        enabled: true,
        createdAt: "2026-03-07T12:00:00.000Z",
        updatedAt: "2026-03-07T12:00:00.000Z",
      }),
    ).toBe("alerts@example.com");
  });
});
