import { describe, expect, it } from "vitest";
import {
  CONFIGURE_SECTIONS,
  DEFAULT_CONFIGURE_SECTION,
  normalizeConfigureSection,
} from "./configure-state";

describe("normalizeConfigureSection", () => {
  it("uses site-context by default when value is null", () => {
    expect(normalizeConfigureSection(null)).toBe(DEFAULT_CONFIGURE_SECTION);
  });

  it("keeps valid sections unchanged", () => {
    for (const section of CONFIGURE_SECTIONS) {
      expect(normalizeConfigureSection(section)).toBe(section);
    }
  });

  it("falls back to site-context for unknown sections", () => {
    expect(normalizeConfigureSection("settings")).toBe(
      DEFAULT_CONFIGURE_SECTION,
    );
    expect(normalizeConfigureSection("unknown-value")).toBe(
      DEFAULT_CONFIGURE_SECTION,
    );
  });
});
