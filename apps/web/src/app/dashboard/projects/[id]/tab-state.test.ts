import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECT_TAB,
  normalizeProjectTab,
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
