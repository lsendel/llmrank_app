import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock, patchMock, putMock, deleteMock } = vi.hoisted(
  () => ({
    getMock: vi.fn(),
    postMock: vi.fn(),
    patchMock: vi.fn(),
    putMock: vi.fn(),
    deleteMock: vi.fn(),
  }),
);

vi.mock("../core/client", () => ({
  apiClient: {
    get: getMock,
    post: postMock,
    patch: patchMock,
    put: putMock,
    delete: deleteMock,
  },
}));

import { createCrawlsApi } from "./crawls";
import { createDashboardApi } from "./dashboard";
import { createPagesApi } from "./pages";
import { createProjectsApi } from "./projects";

describe("projects/crawls/pages/dashboard api domains", () => {
  const projectsApi = createProjectsApi();
  const crawlsApi = createCrawlsApi();
  const pagesApi = createPagesApi();
  const dashboardApi = createDashboardApi();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds filtered project list requests", async () => {
    const response = {
      data: [{ id: "proj-1" }],
      pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
    };
    getMock.mockResolvedValue(response);

    const result = await projectsApi.list({
      page: 2,
      limit: 10,
      q: "seo",
      sort: "score_desc",
    });

    expect(getMock).toHaveBeenCalledWith(
      "/api/projects?page=2&limit=10&q=seo&sort=score_desc",
    );
    expect(result).toBe(response);
  });

  it("posts rerun auto-generation requests with an empty body", async () => {
    postMock.mockResolvedValue({
      data: { pipelineRunId: "run-1", status: "queued" },
    });

    const result = await projectsApi.rerunAutoGeneration("proj-1");

    expect(postMock).toHaveBeenCalledWith(
      "/api/projects/proj-1/rerun-auto-generation",
      {},
    );
    expect(result).toEqual({ pipelineRunId: "run-1", status: "queued" });
  });

  it("builds crawl history list requests with pagination", async () => {
    const response = {
      data: [{ id: "crawl-1" }],
      pagination: { page: 3, limit: 25, total: 1, totalPages: 1 },
    };
    getMock.mockResolvedValue(response);

    const result = await crawlsApi.list("proj-1", { page: 3, limit: 25 });

    expect(getMock).toHaveBeenCalledWith(
      "/api/crawls/project/proj-1?page=3&limit=25",
    );
    expect(result).toBe(response);
  });

  it("loads page enrichments for a page id", async () => {
    getMock.mockResolvedValue({ data: [{ id: "enrich-1", provider: "gsc" }] });

    const result = await pagesApi.getEnrichments("page-1");

    expect(getMock).toHaveBeenCalledWith("/api/pages/page-1/enrichments");
    expect(result).toEqual([{ id: "enrich-1", provider: "gsc" }]);
  });

  it("builds dashboard priority feed requests with a limit", async () => {
    getMock.mockResolvedValue({
      data: [{ id: "item-1", title: "Fix titles" }],
    });

    const result = await dashboardApi.getPriorityFeed(12);

    expect(getMock).toHaveBeenCalledWith(
      "/api/dashboard/priority-feed?limit=12",
    );
    expect(result).toEqual([{ id: "item-1", title: "Fix titles" }]);
  });
});
