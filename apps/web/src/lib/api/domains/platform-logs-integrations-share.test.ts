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

vi.mock("../../api-base-url", () => ({
  apiUrl: (path: string) => `https://api.example.com${path}`,
}));

import { createChannelsApi } from "./channels";
import { createIntegrationsApi } from "./integrations";
import { createLogsApi } from "./logs";
import { createPlatformReadinessApi } from "./platform-readiness";
import { createShareApi } from "./share";

describe("platform/logs/integrations/share/channels api domains", () => {
  const platformReadinessApi = createPlatformReadinessApi();
  const logsApi = createLogsApi();
  const integrationsApi = createIntegrationsApi();
  const shareApi = createShareApi();
  const channelsApi = createChannelsApi();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads platform readiness by crawl id", async () => {
    getMock.mockResolvedValue({ data: [{ platform: "ChatGPT", score: 92 }] });

    const result = await platformReadinessApi.get("crawl-1");

    expect(getMock).toHaveBeenCalledWith(
      "/api/crawls/crawl-1/platform-readiness",
    );
    expect(result).toEqual([{ platform: "ChatGPT", score: 92 }]);
  });

  it("uploads project logs with the provided file payload", async () => {
    postMock.mockResolvedValue({
      data: { id: "upload-1", summary: { totalRequests: 10 } },
    });

    const result = await logsApi.upload("proj-1", {
      filename: "access.log",
      content: "GET / 200",
    });

    expect(postMock).toHaveBeenCalledWith("/api/logs/proj-1/upload", {
      filename: "access.log",
      content: "GET / 200",
    });
    expect(result).toEqual({ id: "upload-1", summary: { totalRequests: 10 } });
  });

  it("builds integration insight urls with encoded crawl ids", async () => {
    getMock.mockResolvedValue({
      data: { crawlId: "crawl 1/2", integrations: {} },
    });

    const result = await integrationsApi.insights("proj-1", "crawl 1/2");

    expect(getMock).toHaveBeenCalledWith(
      "/api/integrations/proj-1/insights?crawlId=crawl%201%2F2",
    );
    expect(result).toEqual({ crawlId: "crawl 1/2", integrations: {} });
  });

  it("syncs integrations without sending a request body", async () => {
    postMock.mockResolvedValue({
      data: { synced: true, enrichmentCount: 3, crawlId: "crawl-1" },
    });

    const result = await integrationsApi.sync("proj-1");

    expect(postMock).toHaveBeenCalledWith("/api/integrations/proj-1/sync");
    expect(result).toEqual({
      synced: true,
      enrichmentCount: 3,
      crawlId: "crawl-1",
    });
  });

  it("enables crawl sharing with the selected settings", async () => {
    postMock.mockResolvedValue({
      data: { shareToken: "token-1", level: "full" },
    });

    const result = await shareApi.enable("crawl-1", { level: "full" });

    expect(postMock).toHaveBeenCalledWith("/api/crawls/crawl-1/share", {
      level: "full",
    });
    expect(result).toEqual({ shareToken: "token-1", level: "full" });
  });

  it("loads public reports through apiUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: { crawlId: "crawl-1", shareLevel: "full" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await shareApi.getPublicReport("token-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/public/reports/token-1",
    );
    expect(result).toEqual({ crawlId: "crawl-1", shareLevel: "full" });
  });

  it("patches notification channels by id", async () => {
    patchMock.mockResolvedValue({ data: { id: "channel-1", enabled: false } });

    const result = await channelsApi.update("channel-1", { enabled: false });

    expect(patchMock).toHaveBeenCalledWith(
      "/api/notification-channels/channel-1",
      {
        enabled: false,
      },
    );
    expect(result).toEqual({ id: "channel-1", enabled: false });
  });
});
