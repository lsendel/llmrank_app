import {
  DEFAULT_SETTINGS_TAB,
  normalizeSettingsTab,
  SETTINGS_TABS,
} from "./tab-state";

describe("settings tab state", () => {
  it("returns default tab when value is missing", () => {
    expect(normalizeSettingsTab(null, true)).toBe(DEFAULT_SETTINGS_TAB);
  });

  it("returns default tab for unknown value", () => {
    expect(normalizeSettingsTab("unknown", true)).toBe(DEFAULT_SETTINGS_TAB);
  });

  it("returns known tab when value is allowed", () => {
    for (const tab of SETTINGS_TABS) {
      if (tab === "sso" || tab === "audit-log") continue;
      expect(normalizeSettingsTab(tab, false)).toBe(tab);
      expect(normalizeSettingsTab(tab, true)).toBe(tab);
    }
  });

  it("guards org-only tabs when org access is unavailable", () => {
    expect(normalizeSettingsTab("sso", false)).toBe(DEFAULT_SETTINGS_TAB);
    expect(normalizeSettingsTab("audit-log", false)).toBe(DEFAULT_SETTINGS_TAB);
    expect(normalizeSettingsTab("sso", true)).toBe("sso");
    expect(normalizeSettingsTab("audit-log", true)).toBe("audit-log");
  });
});
