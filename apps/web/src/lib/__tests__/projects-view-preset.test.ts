import { describe, expect, it } from "vitest";
import {
  defaultProjectsViewPresetFromPersona,
  isProjectsViewPreset,
  normalizeProjectsViewPreset,
  shouldSyncProjectsViewPreset,
} from "../projects-view-preset";

describe("projects view preset helpers", () => {
  it("recognizes valid preset values", () => {
    expect(isProjectsViewPreset("seo_manager")).toBe(true);
    expect(isProjectsViewPreset("content_lead")).toBe(true);
    expect(isProjectsViewPreset("exec_summary")).toBe(true);
    expect(isProjectsViewPreset("invalid")).toBe(false);
    expect(isProjectsViewPreset(null)).toBe(false);
  });

  it("normalizes unknown values to null", () => {
    expect(normalizeProjectsViewPreset("seo_manager")).toBe("seo_manager");
    expect(normalizeProjectsViewPreset("invalid")).toBeNull();
    expect(normalizeProjectsViewPreset(undefined)).toBeNull();
  });

  it("uses exec summary as stable persona fallback", () => {
    expect(defaultProjectsViewPresetFromPersona("agency")).toBe("exec_summary");
    expect(defaultProjectsViewPresetFromPersona("developer")).toBe(
      "exec_summary",
    );
    expect(defaultProjectsViewPresetFromPersona(null)).toBe("exec_summary");
  });

  it("syncs local preset only when server preference is missing", () => {
    expect(
      shouldSyncProjectsViewPreset({
        serverPreset: null,
        localPreset: "content_lead",
      }),
    ).toBe(true);
    expect(
      shouldSyncProjectsViewPreset({
        serverPreset: "exec_summary",
        localPreset: "content_lead",
      }),
    ).toBe(false);
    expect(
      shouldSyncProjectsViewPreset({
        serverPreset: null,
        localPreset: null,
      }),
    ).toBe(false);
    expect(
      shouldSyncProjectsViewPreset({
        serverPreset: null,
        localPreset: "invalid",
      }),
    ).toBe(false);
  });
});
