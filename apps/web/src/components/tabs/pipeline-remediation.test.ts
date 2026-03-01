import { describe, expect, it } from "vitest";
import { getPipelineRemediationTarget } from "./pipeline-remediation";

describe("getPipelineRemediationTarget", () => {
  it("maps known step ids to targeted project tabs", () => {
    const visibility = getPipelineRemediationTarget(
      "proj-1",
      "visibility_check",
    );
    expect(visibility.label).toBe("Visibility Workspace");
    expect(visibility.href).toBe("/dashboard/projects/proj-1?tab=visibility");

    const siteContext = getPipelineRemediationTarget(
      "proj-1",
      "site_description",
    );
    expect(siteContext.label).toBe("Site Context");
    expect(siteContext.href).toBe(
      "/dashboard/projects/proj-1?tab=configure&configure=site-context",
    );
  });

  it("normalizes human-readable step names", () => {
    const target = getPipelineRemediationTarget("proj-1", "Visibility Check");
    expect(target.href).toBe("/dashboard/projects/proj-1?tab=visibility");
  });

  it("falls back to logs for unknown steps", () => {
    const target = getPipelineRemediationTarget("proj-1", "unknown_step");
    expect(target.label).toBe("Logs");
    expect(target.href).toBe("/dashboard/projects/proj-1?tab=logs");
  });
});
