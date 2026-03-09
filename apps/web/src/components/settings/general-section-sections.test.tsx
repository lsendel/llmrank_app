import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NotificationPreferences } from "@/lib/api";
import {
  ClearHistoryCard,
  CurrentPlanCard,
  DangerZoneCard,
  EmailDigestCard,
  NotificationPreferencesCard,
  RoleCard,
  WebhookUrlCard,
} from "./general-section-sections";

describe("general section sections", () => {
  it("renders plan, role, notification, and webhook states", () => {
    const onToggleNotification = vi.fn();
    const onWebhookInputChange = vi.fn();
    const onSaveWebhook = vi.fn();
    const onRemoveWebhook = vi.fn();
    const notifications: NotificationPreferences = {
      notifyOnCrawlComplete: true,
      notifyOnScoreDrop: false,
      webhookUrl: "https://hooks.example.com/abc",
    };

    render(
      <>
        <CurrentPlanCard planName="Pro" />
        <RoleCard persona="agency" savingPersona onPersonaChange={vi.fn()} />
        <NotificationPreferencesCard
          notifications={notifications}
          savingNotification="notifyOnScoreDrop"
          onToggleNotification={onToggleNotification}
        />
        <WebhookUrlCard
          webhookInput="https://hooks.example.com/abc"
          savingWebhook={false}
          webhookError={null}
          webhookSuccess
          hasWebhook
          onWebhookInputChange={onWebhookInputChange}
          onSaveWebhook={onSaveWebhook}
          onRemoveWebhook={onRemoveWebhook}
        />
      </>,
    );

    expect(screen.getByText(/You are currently on the/i)).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Saving...")).toBeInTheDocument();
    expect(
      screen.getByText("Webhook URL saved successfully."),
    ).toBeInTheDocument();

    const switches = screen.getAllByRole("switch");
    expect(switches[0]).toHaveAttribute("aria-checked", "true");
    expect(switches[1]).toHaveAttribute("aria-checked", "false");
    expect(switches[1]).toBeDisabled();

    fireEvent.click(switches[0]);
    expect(onToggleNotification).toHaveBeenCalledWith("notifyOnCrawlComplete");

    fireEvent.change(screen.getByLabelText("HTTPS URL"), {
      target: { value: "https://hooks.example.com/next" },
    });
    expect(onWebhookInputChange).toHaveBeenCalledWith(
      "https://hooks.example.com/next",
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onSaveWebhook).toHaveBeenCalledTimes(1);
    expect(onRemoveWebhook).toHaveBeenCalledTimes(1);
  });

  it("renders digest, clear-history, and danger-zone dialog states", () => {
    render(
      <>
        <EmailDigestCard
          digestPrefs={{
            digestFrequency: "weekly",
            digestDay: 1,
            lastDigestSentAt: null,
          }}
          savingDigest
          onDigestFrequencyChange={vi.fn()}
          onDigestDayChange={vi.fn()}
        />
        <ClearHistoryCard
          clearTarget="proj-1"
          onClearTargetChange={vi.fn()}
          clearDialogOpen
          onClearDialogOpenChange={vi.fn()}
          clearing
          clearResult="Deleted 2 crawls from Marketing Site."
          projectsList={[{ id: "proj-1", name: "Marketing Site" }]}
          onClearHistory={vi.fn()}
        />
        <DangerZoneCard
          deleteDialogOpen
          onDeleteDialogOpenChange={vi.fn()}
          deleting
          onDeleteAccount={vi.fn()}
        />
      </>,
    );

    expect(screen.getByText("Send on")).toBeInTheDocument();
    expect(
      screen.getByText("Deleted 2 crawls from Marketing Site."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Marketing Site|all projects/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Deleting...").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.queryByText(/Yes, delete my account/i),
    ).not.toBeInTheDocument();
  });
});
