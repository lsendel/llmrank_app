import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECT_TAB,
  GROUP_DEFAULT_TABS,
  normalizeProjectTab,
  projectTabGroup,
  PROJECT_TABS,
} from "./tab-state";

describe("normalizeProjectTab", () => {
  it("uses overview by default when tab is null", () => {
    expect(normalizeProjectTab(null)).toBe(DEFAULT_PROJECT_TAB);
  });

  it("keeps valid tabs unchanged", () => {
    for (const tab of PROJECT_TABS) {
      expect(normalizeProjectTab(tab)).toBe(tab);
    }
  });

  it("falls back to overview for unknown tabs", () => {
    expect(normalizeProjectTab("billing")).toBe(DEFAULT_PROJECT_TAB);
    expect(normalizeProjectTab("unknown-value")).toBe(DEFAULT_PROJECT_TAB);
  });
});

describe("projectTabGroup", () => {
  it("maps tabs into workflow groups", () => {
    expect(projectTabGroup("overview")).toBe("analyze");
    expect(projectTabGroup("issues")).toBe("analyze");
    expect(projectTabGroup("visibility")).toBe("grow-visibility");
    expect(projectTabGroup("strategy")).toBe("grow-visibility");
    expect(projectTabGroup("automation")).toBe("automate-operate");
    expect(projectTabGroup("reports")).toBe("automate-operate");
    expect(projectTabGroup("settings")).toBe("configure");
  });

  it("has stable defaults for each group", () => {
    expect(GROUP_DEFAULT_TABS.analyze).toBe("overview");
    expect(GROUP_DEFAULT_TABS["grow-visibility"]).toBe("visibility");
    expect(GROUP_DEFAULT_TABS["automate-operate"]).toBe("automation");
    expect(GROUP_DEFAULT_TABS.configure).toBe("settings");
  });
});
