import { Bell, ShieldCheck, UserCog, type LucideIcon } from "lucide-react";
import { DEFAULT_SETTINGS_TAB, type SettingsTab } from "./tab-state";

export interface SettingsTabMeta {
  value: SettingsTab;
  label: string;
  requiresOrg?: boolean;
}

export interface SettingsWorkflowStep {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const SETTINGS_TABS_META: SettingsTabMeta[] = [
  { value: "general", label: "General" },
  { value: "branding", label: "Branding" },
  { value: "notifications", label: "Notifications" },
  { value: "api-tokens", label: "API Tokens" },
  { value: "team", label: "Team" },
  { value: "sso", label: "SSO", requiresOrg: true },
  { value: "audit-log", label: "Audit Log", requiresOrg: true },
];

export const SETTINGS_WORKFLOW_STEPS: SettingsWorkflowStep[] = [
  {
    title: "Set workspace defaults",
    description:
      "Keep project behavior consistent with stable account and branding defaults.",
    icon: UserCog,
  },
  {
    title: "Control notifications and digests",
    description:
      "Send only actionable updates so marketers and operators can execute faster.",
    icon: Bell,
  },
  {
    title: "Manage access and compliance",
    description:
      "Review team, SSO, and audit controls as your organization scales.",
    icon: ShieldCheck,
  },
];

export function buildSettingsTabQueryString(
  currentSearchParams: string,
  tab: SettingsTab,
): string {
  const nextParams = new URLSearchParams(currentSearchParams);

  if (tab === DEFAULT_SETTINGS_TAB) {
    nextParams.delete("tab");
  } else {
    nextParams.set("tab", tab);
  }

  return nextParams.toString();
}

export function buildSettingsPageHref(tab: SettingsTab): string {
  const qs = buildSettingsTabQueryString("", tab);
  return qs ? `/dashboard/settings?${qs}` : "/dashboard/settings";
}

export function getVisibleSettingsTabs(
  orgId: string | null,
): SettingsTabMeta[] {
  return SETTINGS_TABS_META.filter((tab) => !tab.requiresOrg || orgId);
}

export function getSettingsWorkflowActions(orgId: string | null) {
  return [
    {
      label: "General",
      href: buildSettingsPageHref("general"),
      variant: "outline" as const,
    },
    {
      label: "Notifications",
      href: buildSettingsPageHref("notifications"),
      variant: "ghost" as const,
    },
    ...(orgId
      ? [
          {
            label: "Team",
            href: buildSettingsPageHref("team"),
            variant: "ghost" as const,
          },
        ]
      : []),
  ];
}
