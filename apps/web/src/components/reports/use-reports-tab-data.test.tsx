import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useReportsTabData } from "./use-reports-tab-data";

describe("useReportsTabData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.reports.list = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads reports on mount", async () => {
    api.reports.list = vi.fn(async () => [
      {
        id: "report-1",
        projectId: "proj-1",
        crawlJobId: "crawl-1",
        type: "summary",
        format: "pdf",
        status: "complete",
        r2Key: null,
        fileSize: null,
        config: {},
        error: null,
        generatedAt: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    const { result } = renderHook(() =>
      useReportsTabData({ projectId: "proj-1" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reports).toHaveLength(1);
    expect(api.reports.list).toHaveBeenCalledWith("proj-1");
  });

  it("polls while a report is still pending", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    api.reports.list = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "report-1",
          projectId: "proj-1",
          crawlJobId: "crawl-1",
          type: "summary",
          format: "pdf",
          status: "queued",
          r2Key: null,
          fileSize: null,
          config: {},
          error: null,
          generatedAt: null,
          expiresAt: null,
          createdAt: new Date().toISOString(),
        },
      ])
      .mockResolvedValueOnce([]);

    renderHook(() => useReportsTabData({ projectId: "proj-1" }));

    await waitFor(() => expect(api.reports.list).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    await waitFor(() => expect(api.reports.list).toHaveBeenCalledTimes(2));
  });
});
