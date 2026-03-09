import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useLogsTabData } from "./use-logs-tab-data";

const { mockUseApiSWR } = vi.hoisted(() => ({
  mockUseApiSWR: vi.fn(),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => mockUseApiSWR(...args),
}));

describe("useLogsTabData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads uploads for the project and exposes the mutate handle", async () => {
    const mutateUploads = vi.fn();
    const uploads = [
      {
        id: "upload-1",
        projectId: "proj-1",
        filename: "access.log",
        totalRequests: 100,
        crawlerRequests: 20,
        uniqueIPs: 10,
        summary: {
          totalRequests: 100,
          crawlerRequests: 20,
          uniqueIPs: 10,
          botBreakdown: [],
          statusBreakdown: [],
          topPaths: [],
        },
        createdAt: new Date().toISOString(),
      },
    ];
    mockUseApiSWR.mockReturnValue({
      data: uploads,
      isLoading: false,
      mutate: mutateUploads,
    });
    api.logs.list = vi.fn(async () => uploads);

    const { result } = renderHook(() =>
      useLogsTabData({ projectId: "proj-1" }),
    );

    expect(result.current.uploads).toEqual(uploads);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.mutateUploads).toBe(mutateUploads);

    const [, fetcher] = mockUseApiSWR.mock.calls[0] as [
      string,
      () => Promise<unknown>,
    ];
    await fetcher();
    expect(api.logs.list).toHaveBeenCalledWith("proj-1");
  });
});
