import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLastProjectContext,
  getLastProjectContext,
  lastProjectContextHref,
  projectTabLabel,
  saveLastProjectContext,
} from "@/lib/workflow-memory";

describe("workflow memory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists and reads last project context", () => {
    saveLastProjectContext({
      projectId: "proj-123",
      tab: "issues",
      projectName: "Acme",
      domain: "acme.com",
    });

    const context = getLastProjectContext();
    expect(context).not.toBeNull();
    expect(context?.projectId).toBe("proj-123");
    expect(context?.tab).toBe("issues");
    expect(context?.projectName).toBe("Acme");
    expect(context?.domain).toBe("acme.com");
    expect(context?.visitedAt).toBeTypeOf("string");
  });

  it("ignores malformed payloads", () => {
    localStorage.setItem("llmrank:workflow:last-project-context", "{bad");
    expect(getLastProjectContext()).toBeNull();

    localStorage.setItem(
      "llmrank:workflow:last-project-context",
      JSON.stringify({
        projectId: "proj-1",
        tab: "not-real",
        visitedAt: new Date().toISOString(),
      }),
    );
    expect(getLastProjectContext()).toBeNull();
  });

  it("builds resume href and labels", () => {
    saveLastProjectContext({
      projectId: "proj-777",
      tab: "visibility",
      projectName: "Example",
    });
    const context = getLastProjectContext();
    expect(context).not.toBeNull();
    expect(lastProjectContextHref(context!)).toBe(
      "/dashboard/projects/proj-777?tab=visibility",
    );
    expect(projectTabLabel("visibility")).toBe("Visibility");
  });

  it("clears stored context", () => {
    saveLastProjectContext({
      projectId: "proj-1",
      tab: "overview",
    });
    clearLastProjectContext();
    expect(getLastProjectContext()).toBeNull();
  });
});
