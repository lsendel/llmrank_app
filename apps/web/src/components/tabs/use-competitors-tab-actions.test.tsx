import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useCompetitorsTabActions } from "./use-competitors-tab-actions";

const { mockWithAuth } = vi.hoisted(() => ({
  mockWithAuth: vi.fn((callback: () => Promise<unknown> | unknown) =>
    callback(),
  ),
}));

vi.mock("@/lib/use-api", () => ({
  useApi: () => ({ withAuth: mockWithAuth }),
}));

describe("useCompetitorsTabActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.benchmarks.trigger = vi.fn(async () => undefined);
    api.competitorMonitoring.rebenchmark = vi.fn(async () => undefined);
    api.competitorMonitoring.updateMonitoring = vi.fn(async () => undefined);
  });

  it("benchmarks a competitor and refreshes both data sources", async () => {
    const mutateBenchmarks = vi.fn(async () => undefined);
    const mutateStrategy = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useCompetitorsTabActions({
        projectId: "proj-1",
        mutateBenchmarks,
        mutateStrategy,
      }),
    );

    act(() => {
      result.current.setNewDomain("example.com");
    });

    await act(async () => {
      await result.current.handleBenchmark();
    });

    expect(api.benchmarks.trigger).toHaveBeenCalledWith({
      projectId: "proj-1",
      competitorDomain: "example.com",
    });
    expect(mutateBenchmarks).toHaveBeenCalledTimes(1);
    expect(mutateStrategy).toHaveBeenCalledTimes(1);
    expect(result.current.newDomain).toBe("");
    expect(result.current.error).toBeNull();
  });

  it("captures a failed rebenchmark and retries the last failed action", async () => {
    const rebenchmark = vi
      .fn()
      .mockRejectedValueOnce(new Error("Request failed"))
      .mockResolvedValueOnce(undefined);
    api.competitorMonitoring.rebenchmark = rebenchmark;

    const { result } = renderHook(() =>
      useCompetitorsTabActions({
        projectId: "proj-1",
        mutateBenchmarks: vi.fn(async () => undefined),
        mutateStrategy: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.handleRebenchmark("comp-1");
    });

    expect(result.current.error).toBe("Request failed");
    expect(result.current.lastFailedAction).not.toBeNull();

    await act(async () => {
      result.current.handleRetry();
    });

    expect(rebenchmark).toHaveBeenCalledTimes(2);
  });
});
