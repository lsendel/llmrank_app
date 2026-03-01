export const SETTINGS_TABS = [
  "general",
  "branding",
  "notifications",
  "api-tokens",
  "team",
  "sso",
  "audit-log",
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const DEFAULT_SETTINGS_TAB: SettingsTab = "general";

const ORG_ONLY_TABS = new Set<SettingsTab>(["sso", "audit-log"]);

export function normalizeSettingsTab(
  tab: string | null,
  hasOrganizationAccess: boolean,
): SettingsTab {
  if (!tab) return DEFAULT_SETTINGS_TAB;

  const normalizedTab = tab as SettingsTab;
  if (!SETTINGS_TABS.includes(normalizedTab)) {
    return DEFAULT_SETTINGS_TAB;
  }

  if (!hasOrganizationAccess && ORG_ONLY_TABS.has(normalizedTab)) {
    return DEFAULT_SETTINGS_TAB;
  }

  return normalizedTab;
}
