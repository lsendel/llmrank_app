import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLastProjectContext,
  getLastProjectContext,
  lastProjectContextHref,
  normalizeLastProjectContext,
  pickMostRecentProjectContext,
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

  it("normalizes server payloads and rejects invalid tabs", () => {
    expect(
      normalizeLastProjectContext({
        projectId: "proj-2",
        tab: "actions",
        projectName: "Site",
        domain: "site.com",
        visitedAt: "2026-03-05T12:00:00.000Z",
      }),
    ).toEqual({
      projectId: "proj-2",
      tab: "actions",
      projectName: "Site",
      domain: "site.com",
      visitedAt: "2026-03-05T12:00:00.000Z",
    });

    expect(
      normalizeLastProjectContext({
        projectId: "proj-2",
        tab: "not_a_tab",
        visitedAt: "2026-03-05T12:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("prefers the most recently visited context", () => {
    const context = pickMostRecentProjectContext([
      {
        projectId: "proj-old",
        tab: "overview",
        projectName: "Old",
        domain: "old.com",
        visitedAt: "2026-03-04T12:00:00.000Z",
      },
      {
        projectId: "proj-new",
        tab: "issues",
        projectName: "New",
        domain: "new.com",
        visitedAt: "2026-03-05T12:00:00.000Z",
      },
    ]);
    expect(context?.projectId).toBe("proj-new");
    expect(context?.tab).toBe("issues");
  });

  it("keeps provided visitedAt when hydrating local cache from server", () => {
    saveLastProjectContext({
      projectId: "proj-sync",
      tab: "reports",
      visitedAt: "2026-03-05T01:02:03.000Z",
    });
    expect(getLastProjectContext()?.visitedAt).toBe("2026-03-05T01:02:03.000Z");
  });
});
