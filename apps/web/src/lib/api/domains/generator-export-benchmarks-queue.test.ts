import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock, postDownloadMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  postDownloadMock: vi.fn(),
}));

vi.mock("../core/client", () => ({
  apiClient: {
    get: getMock,
    post: postMock,
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../core/download", () => ({
  postDownload: postDownloadMock,
}));

vi.mock("../../api-base-url", () => ({
  apiUrl: (path: string) => `https://api.example.com${path}`,
}));

import { createBenchmarksApi } from "./benchmarks";
import { createExportsApi } from "./exports";
import { createGeneratorsApi } from "./generators";
import { createQueueApi } from "./queue";

describe("generator/export/benchmarks/queue api domains", () => {
  const generatorsApi = createGeneratorsApi();
  const exportsApi = createExportsApi();
  const benchmarksApi = createBenchmarksApi();
  const queueApi = createQueueApi();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("downloads generated sitemap artifacts", async () => {
    postDownloadMock.mockResolvedValue({
      filename: "sitemap.xml",
      content: "<xml />",
    });

    const result = await generatorsApi.sitemap("proj-1");

    expect(postDownloadMock).toHaveBeenCalledWith(
      "/api/projects/proj-1/generate/sitemap",
    );
    expect(result).toEqual({ filename: "sitemap.xml", content: "<xml />" });
  });

  it("opens exports in a new tab using apiUrl", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    exportsApi.download("proj-1", "csv");

    expect(openSpy).toHaveBeenCalledWith(
      "https://api.example.com/api/projects/proj-1/export?format=csv",
      "_blank",
    );
  });

  it("loads public benchmarks", async () => {
    getMock.mockResolvedValue({ data: { p50: 80, count: 12 } });

    const result = await benchmarksApi.get();

    expect(getMock).toHaveBeenCalledWith("/api/public/benchmarks");
    expect(result).toEqual({ p50: 80, count: 12 });
  });

  it("loads project benchmark comparisons", async () => {
    getMock.mockResolvedValue({
      data: { projectScores: { overall: 80 }, competitors: [] },
    });

    const result = await benchmarksApi.list("proj-1");

    expect(getMock).toHaveBeenCalledWith("/api/competitors?projectId=proj-1");
    expect(result).toEqual({ projectScores: { overall: 80 }, competitors: [] });
  });

  it("triggers benchmark runs with the expected payload", async () => {
    postMock.mockResolvedValue(undefined);

    await benchmarksApi.trigger({
      projectId: "proj-1",
      competitorDomain: "example.com",
    });

    expect(postMock).toHaveBeenCalledWith("/api/competitors/benchmark", {
      projectId: "proj-1",
      competitorDomain: "example.com",
    });
  });

  it("lists queue items with pagination parameters", async () => {
    getMock.mockResolvedValue({
      data: [{ id: "job-1" }],
      pagination: { page: 2, limit: 20, total: 1, totalPages: 1 },
    });

    const result = await queueApi.list({ page: 2, limit: 20 });

    expect(getMock).toHaveBeenCalledWith("/api/queue?page=2&limit=20");
    expect(result).toEqual({
      data: [{ id: "job-1" }],
      pagination: { page: 2, limit: 20, total: 1, totalPages: 1 },
    });
  });
});
