import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";
import { useLogsTabActions } from "./use-logs-tab-actions";

const { mockWithAuth } = vi.hoisted(() => ({
  mockWithAuth: vi.fn((callback: () => Promise<unknown> | unknown) =>
    callback(),
  ),
}));

vi.mock("@/lib/use-api", () => ({
  useApi: () => ({ withAuth: mockWithAuth }),
}));

describe("useLogsTabActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a log file and refreshes history", async () => {
    const mutateUploads = vi.fn(async () => undefined);
    const summary = {
      totalRequests: 100,
      crawlerRequests: 20,
      uniqueIPs: 10,
      botBreakdown: [],
      statusBreakdown: [],
      topPaths: [],
    };
    api.logs.upload = vi.fn(async () => ({ id: "upload-1", summary }));

    const { result } = renderHook(() =>
      useLogsTabActions({ projectId: "proj-1", mutateUploads }),
    );
    const file = new File(["log lines"], "access.log", { type: "text/plain" });
    Object.defineProperty(file, "text", {
      value: vi.fn(async () => "log lines"),
    });

    await act(async () => {
      await result.current.handleFileUpload(file);
    });

    expect(api.logs.upload).toHaveBeenCalledWith("proj-1", {
      filename: "access.log",
      content: "log lines",
    });
    expect(mutateUploads).toHaveBeenCalledTimes(1);
    expect(result.current.latestSummary).toEqual(summary);
    expect(result.current.error).toBeNull();
  });

  it("captures upload failures and retries the last failed file", async () => {
    const mutateUploads = vi.fn(async () => undefined);
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(422, "LOG_INVALID", "Bad log file"))
      .mockResolvedValueOnce({
        id: "upload-1",
        summary: {
          totalRequests: 10,
          crawlerRequests: 2,
          uniqueIPs: 1,
          botBreakdown: [],
          statusBreakdown: [],
          topPaths: [],
        },
      });
    api.logs.upload = upload;

    const { result } = renderHook(() =>
      useLogsTabActions({ projectId: "proj-1", mutateUploads }),
    );
    const file = new File(["bad log"], "broken.log", { type: "text/plain" });
    Object.defineProperty(file, "text", {
      value: vi.fn(async () => "bad log"),
    });

    await act(async () => {
      await result.current.handleFileUpload(file);
    });

    expect(result.current.error).toBe("Bad log file");
    expect(result.current.canRetryUpload).toBe(true);

    await act(async () => {
      result.current.handleRetryUpload();
    });

    expect(upload).toHaveBeenCalledTimes(2);

    act(() => {
      result.current.handleDismissError();
    });

    expect(result.current.error).toBeNull();
  });
});
