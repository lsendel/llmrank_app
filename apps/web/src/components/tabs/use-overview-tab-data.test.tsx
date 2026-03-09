import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOverviewTabData } from "./use-overview-tab-data";

const { mockUseApiSWR } = vi.hoisted(() => ({
  mockUseApiSWR: vi.fn(),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => mockUseApiSWR(...args),
}));

describe("useOverviewTabData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads insights and progress while deriving crawl freshness metadata", () => {
    mockUseApiSWR.mockImplementation((key: string | null) => {
      if (key === "insights-crawl-1") {
        return {
          data: {
            issueDistribution: { bySeverity: {}, byCategory: {}, total: 4 },
            gradeDistribution: [],
          },
        };
      }
      if (key === "progress-proj-1") {
        return { data: { categoryDeltas: { aiReadiness: { delta: 3 } } } };
      }
      return { data: undefined };
    });

    const { result } = renderHook(() =>
      useOverviewTabData({
        latestCrawl: {
          id: "crawl-1",
          status: "complete",
          createdAt: "2024-01-01T00:00:00.000Z",
          completedAt: "2024-01-02T00:00:00.000Z",
          pagesScored: 4,
          pagesCrawled: 6,
          pagesFound: 8,
          scores: { technical: 70 },
        } as never,
        projectId: "proj-1",
      }),
    );

    expect(result.current.crawlId).toBe("crawl-1");
    expect(result.current.insights?.issueDistribution.total).toBe(4);
    expect(result.current.progress?.categoryDeltas.aiReadiness.delta).toBe(3);
    expect(result.current.hasScores).toBe(true);
    expect(result.current.pagesSampled).toBe(8);
    expect(result.current.statusState).toBeNull();
  });

  it("returns an empty-state summary when there is no completed crawl", () => {
    mockUseApiSWR.mockReturnValue({ data: undefined });

    const { result } = renderHook(() =>
      useOverviewTabData({ latestCrawl: undefined, projectId: "proj-1" }),
    );

    expect(result.current.crawlId).toBeUndefined();
    expect(result.current.hasScores).toBe(false);
    expect(result.current.pagesSampled).toBe(0);
    expect(result.current.statusState).toEqual({ kind: "empty" });
  });
});
