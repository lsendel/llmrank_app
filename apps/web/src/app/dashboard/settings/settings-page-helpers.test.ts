import { describe, expect, it } from "vitest";
import {
  buildSettingsPageHref,
  buildSettingsTabQueryString,
  getSettingsWorkflowActions,
  getVisibleSettingsTabs,
} from "./settings-page-helpers";

describe("settings page helpers", () => {
  it("builds tab query strings and hrefs with default-tab cleanup", () => {
    const nextParams = new URLSearchParams(
      buildSettingsTabQueryString("foo=bar&tab=team", "general"),
    );

    expect(nextParams.get("foo")).toBe("bar");
    expect(nextParams.has("tab")).toBe(false);
    expect(buildSettingsPageHref("general")).toBe("/dashboard/settings");
    expect(buildSettingsPageHref("notifications")).toBe(
      "/dashboard/settings?tab=notifications",
    );
  });

  it("filters org-only tabs and workflow actions based on organization access", () => {
    expect(getVisibleSettingsTabs(null).map((tab) => tab.value)).toEqual([
      "general",
      "branding",
      "notifications",
      "api-tokens",
      "team",
    ]);
    expect(getVisibleSettingsTabs("org_123").map((tab) => tab.value)).toEqual([
      "general",
      "branding",
      "notifications",
      "api-tokens",
      "team",
      "sso",
      "audit-log",
    ]);

    expect(
      getSettingsWorkflowActions(null).map((action) => action.label),
    ).toEqual(["General", "Notifications"]);
    expect(
      getSettingsWorkflowActions("org_123").map((action) => action.label),
    ).toEqual(["General", "Notifications", "Team"]);
  });
});
