import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryPageData } from "./use-history-page-data";

const { mockUseApiSWR, mockUsePlan } = vi.hoisted(() => ({
  mockUseApiSWR: vi.fn(),
  mockUsePlan: vi.fn(),
}));

vi.mock("@/hooks/use-plan", () => ({
  usePlan: mockUsePlan,
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: mockUseApiSWR,
}));

describe("useHistoryPageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePlan.mockReturnValue({ isFree: false });
    mockUseApiSWR.mockImplementation((key: string | null) => ({
      data:
        key === null
          ? undefined
          : {
              data: [
                {
                  id: `crawl-${key}`,
                  projectId: "proj-1",
                  projectName: "Marketing Site",
                  status: "complete",
                  startedAt: null,
                  completedAt: null,
                  pagesFound: 10,
                  pagesCrawled: 10,
                  pagesScored: 8,
                  pagesErrored: 0,
                  overallScore: 88,
                  letterGrade: "A",
                  scores: null,
                  errorMessage: null,
                  summary: null,
                  createdAt: "2024-03-10T00:00:00.000Z",
                },
              ],
              pagination: { totalPages: 3 },
            },
      isLoading: false,
    }));
  });

  it("skips crawl history loading on the free plan", () => {
    mockUsePlan.mockReturnValue({ isFree: true });

    const { result } = renderHook(() => useHistoryPageData());

    expect(mockUseApiSWR).toHaveBeenCalledWith(null, expect.any(Function));
    expect(result.current.isFree).toBe(true);
    expect(result.current.history).toEqual([]);
    expect(result.current.showPagination).toBe(false);
  });

  it("loads paid history and updates pagination state", () => {
    const { result } = renderHook(() => useHistoryPageData());

    expect(result.current.page).toBe(1);
    expect(result.current.history).toHaveLength(1);
    expect(mockUseApiSWR).toHaveBeenLastCalledWith(
      "crawl-history-1",
      expect.any(Function),
    );

    act(() => {
      result.current.goToNextPage();
    });

    expect(result.current.page).toBe(2);
    expect(mockUseApiSWR).toHaveBeenLastCalledWith(
      "crawl-history-2",
      expect.any(Function),
    );

    act(() => {
      result.current.goToNextPage();
      result.current.goToNextPage();
    });

    expect(result.current.page).toBe(3);

    act(() => {
      result.current.goToPreviousPage();
    });

    expect(result.current.page).toBe(2);
    expect(result.current.showPagination).toBe(true);
  });
});
