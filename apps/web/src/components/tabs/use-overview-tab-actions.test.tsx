import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useOverviewTabActions } from "./use-overview-tab-actions";

describe("useOverviewTabActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.exports.download = vi.fn(async () => undefined);
  });

  it("exports csv and json reports for the current project", () => {
    const { result } = renderHook(() =>
      useOverviewTabActions({ projectId: "proj-1" }),
    );

    result.current.handleExportCsv();
    result.current.handleExportJson();

    expect(api.exports.download).toHaveBeenNthCalledWith(1, "proj-1", "csv");
    expect(api.exports.download).toHaveBeenNthCalledWith(2, "proj-1", "json");
  });
});
