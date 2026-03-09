import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  SettingsOrgError,
  SettingsPageHeader,
  SettingsTabsShell,
  SettingsWorkflowCard,
} from "./settings-page-sections";

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("@/components/settings/general-section", () => ({
  GeneralSection: () => <div>General Section</div>,
}));

vi.mock("@/components/settings/branding-section", () => ({
  BrandingSection: () => <div>Branding Section</div>,
}));

vi.mock("@/components/settings/notification-channels-section", () => ({
  NotificationChannelsSection: () => <div>Notification Channels Section</div>,
}));

vi.mock("@/components/settings/api-tokens-section", () => ({
  ApiTokensSection: () => <div>API Tokens Section</div>,
}));

vi.mock("@/components/settings/digest-preferences-section", () => ({
  DigestPreferencesSection: () => <div>Digest Preferences Section</div>,
}));

vi.mock("@/components/ui/workflow-guidance", () => ({
  WorkflowGuidance: ({
    title,
    description,
    actions,
  }: {
    title: string;
    description: string;
    actions: Array<{ label: string }>;
  }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
      <span>{actions.map((action) => action.label).join(",")}</span>
    </div>
  ),
}));

vi.mock("@/components/ui/state", () => ({
  StateMessage: ({
    title,
    description,
    retry,
  }: {
    title: string;
    description?: string;
    retry?: { onClick: () => void };
  }) => (
    <div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {retry ? <button onClick={retry.onClick}>Retry</button> : null}
    </div>
  ),
}));

describe("settings page sections", () => {
  it("renders header, workflow actions, and organization error state", () => {
    const onRetry = vi.fn();

    render(
      <>
        <SettingsPageHeader />
        <SettingsWorkflowCard orgId={null} />
        <SettingsOrgError show onRetry={onRetry} />
      </>,
    );

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Manage your account, plan, and notification preferences/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Settings workflow")).toBeInTheDocument();
    expect(screen.getByText("General,Notifications")).toBeInTheDocument();
    expect(
      screen.getByText("Could not load organization settings"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows org-only tabs only when an organization is available", () => {
    const onTabChange = vi.fn();
    const { rerender } = render(
      <SettingsTabsShell
        activeTab="general"
        onTabChange={onTabChange}
        orgId={null}
      />,
    );

    expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Team" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "SSO" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Audit Log" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("General Section")).toBeInTheDocument();

    rerender(
      <SettingsTabsShell
        activeTab="notifications"
        onTabChange={onTabChange}
        orgId="org_123"
      />,
    );

    expect(screen.getByRole("tab", { name: "SSO" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Audit Log" })).toBeInTheDocument();
    expect(
      screen.getByText("Notification Channels Section"),
    ).toBeInTheDocument();
    expect(screen.getByText("Digest Preferences Section")).toBeInTheDocument();
  });
});
