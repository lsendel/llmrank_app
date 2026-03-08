import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock, patchMock, normalizeDomainMock } = vi.hoisted(
  () => ({
    getMock: vi.fn(),
    postMock: vi.fn(),
    patchMock: vi.fn(),
    normalizeDomainMock: vi.fn((url: string) => `normalized:${url}`),
  }),
);

vi.mock("@llm-boost/shared", () => ({
  normalizeDomain: normalizeDomainMock,
}));

vi.mock("../core/client", () => ({
  apiClient: {
    get: getMock,
    post: postMock,
    patch: patchMock,
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { createFixesApi } from "./fixes";
import { createPipelineApi } from "./pipeline";
import { createPublicApi } from "./public";
import { createQuickWinsApi } from "./quick-wins";

describe("extracted api domains", () => {
  const publicApi = createPublicApi();
  const pipelineApi = createPipelineApi();
  const quickWinsApi = createQuickWinsApi();
  const fixesApi = createFixesApi();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes public scan domains before posting", async () => {
    postMock.mockResolvedValue({
      data: { scanResultId: "scan-1", domain: "example.com" },
    });

    const result = await publicApi.scan("https://example.com/");

    expect(normalizeDomainMock).toHaveBeenCalledWith("https://example.com/");
    expect(postMock).toHaveBeenCalledWith("/api/public/scan", {
      url: "normalized:https://example.com/",
    });
    expect(result).toEqual({ scanResultId: "scan-1", domain: "example.com" });
  });

  it("builds tokenized public scan result requests", async () => {
    getMock.mockResolvedValue({
      data: { id: "scan-1", url: "https://example.com" },
    });

    const result = await publicApi.getScanResult("scan-1", "share-token");

    expect(getMock).toHaveBeenCalledWith(
      "/api/public/scan-results/scan-1?token=share-token",
    );
    expect(result).toEqual({ id: "scan-1", url: "https://example.com" });
  });

  it("returns the http fallback flag without envelope unwrapping", async () => {
    getMock.mockResolvedValue({ enabled: true });

    await expect(publicApi.isHttpFallbackEnabled()).resolves.toBe(true);
    expect(getMock).toHaveBeenCalledWith("/api/public/settings/http-fallback");
  });

  it("patches pipeline settings and unwraps the response", async () => {
    patchMock.mockResolvedValue({ data: { autoRunOnCrawl: false } });

    const result = await pipelineApi.updateSettings("proj-1", {
      autoRunOnCrawl: false,
    });

    expect(patchMock).toHaveBeenCalledWith("/api/pipeline/proj-1/settings", {
      autoRunOnCrawl: false,
    });
    expect(result).toEqual({ autoRunOnCrawl: false });
  });

  it("loads quick wins for a crawl", async () => {
    getMock.mockResolvedValue({ data: [{ code: "MISSING_TITLE" }] });

    const result = await quickWinsApi.get("crawl-1");

    expect(getMock).toHaveBeenCalledWith("/api/crawls/crawl-1/quick-wins");
    expect(result).toEqual([{ code: "MISSING_TITLE" }]);
  });

  it("keeps fixes history as a raw paginated response", async () => {
    const response = {
      data: [{ id: "job-1" }],
      pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
    };
    getMock.mockResolvedValue(response);

    const result = await fixesApi.getHistory(2, 10);

    expect(getMock).toHaveBeenCalledWith("/crawls/history?page=2&limit=10");
    expect(result).toBe(response);
  });

  it("posts ai fix generation requests", async () => {
    postMock.mockResolvedValue({
      data: { generatedFix: "Fix title", fixType: "meta" },
    });

    const result = await fixesApi.generate({
      projectId: "proj-1",
      pageId: "page-1",
      issueCode: "MISSING_TITLE",
    });

    expect(postMock).toHaveBeenCalledWith("/api/fixes/generate", {
      projectId: "proj-1",
      pageId: "page-1",
      issueCode: "MISSING_TITLE",
    });
    expect(result).toEqual({ generatedFix: "Fix title", fixType: "meta" });
  });
});
