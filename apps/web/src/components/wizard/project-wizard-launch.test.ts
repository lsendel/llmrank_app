import { describe, expect, it, vi } from "vitest";
import { launchProjectWizard } from "./project-wizard-launch";

const applyProjectWorkspaceDefaultsMock = vi.fn();

vi.mock("@/lib/project-workspace-defaults", () => ({
  applyProjectWorkspaceDefaults: (...args: unknown[]) =>
    applyProjectWorkspaceDefaultsMock(...args),
}));

describe("launchProjectWizard", () => {
  it("creates the project, persists defaults, and starts the crawl", async () => {
    const createProject = vi.fn().mockResolvedValue({ id: "proj-1" });
    const createKeywordsBatch = vi.fn().mockResolvedValue(undefined);
    const addCompetitor = vi.fn().mockResolvedValue(undefined);
    const startCrawl = vi.fn().mockResolvedValue({ id: "crawl-1" });
    applyProjectWorkspaceDefaultsMock.mockResolvedValue({
      failed: [],
      digestEnabled: false,
    });

    const result = await launchProjectWizard(
      {
        name: "Example",
        domain: "https://example.com",
        keywords: [{ keyword: "ai seo" }],
        competitors: [
          { domain: "competitor.com", selected: true },
          { domain: "ignored.com", selected: false },
        ],
        pageLimit: 50,
        crawlDepth: 5,
        crawlSchedule: "daily",
        enablePipeline: true,
        enableVisibility: true,
      },
      {
        createProject,
        createKeywordsBatch,
        addCompetitor,
        startCrawl,
      },
    );

    expect(createProject).toHaveBeenCalledWith({
      name: "Example",
      domain: "example.com",
    });
    expect(createKeywordsBatch).toHaveBeenCalledWith("proj-1", ["ai seo"]);
    expect(applyProjectWorkspaceDefaultsMock).toHaveBeenCalledWith({
      projectId: "proj-1",
      domainOrUrl: "example.com",
      defaults: {
        schedule: "daily",
        maxPages: 50,
        maxDepth: 5,
        autoRunOnCrawl: true,
        enableVisibilitySchedule: true,
      },
    });
    expect(addCompetitor).toHaveBeenCalledTimes(1);
    expect(addCompetitor).toHaveBeenCalledWith("proj-1", "competitor.com");
    expect(startCrawl).toHaveBeenCalledWith("proj-1");
    expect(result).toEqual({
      projectId: "proj-1",
      crawlId: "crawl-1",
      crawlStartFailed: false,
      defaultsFailed: [],
    });
  });

  it("returns a partial-success result when crawl start fails", async () => {
    applyProjectWorkspaceDefaultsMock.mockResolvedValue({
      failed: ["visibility_schedule"],
      digestEnabled: false,
    });

    const result = await launchProjectWizard(
      {
        name: "Example",
        domain: "example.com",
        keywords: [],
        competitors: [],
        pageLimit: 10,
        crawlDepth: 3,
        crawlSchedule: "weekly",
        enablePipeline: false,
        enableVisibility: false,
      },
      {
        createProject: vi.fn().mockResolvedValue({ id: "proj-2" }),
        createKeywordsBatch: vi.fn().mockResolvedValue(undefined),
        addCompetitor: vi.fn().mockResolvedValue(undefined),
        startCrawl: vi.fn().mockRejectedValue(new Error("crawler unavailable")),
      },
    );

    expect(result).toEqual({
      projectId: "proj-2",
      crawlId: null,
      crawlStartFailed: true,
      defaultsFailed: ["visibility_schedule"],
    });
  });
});
