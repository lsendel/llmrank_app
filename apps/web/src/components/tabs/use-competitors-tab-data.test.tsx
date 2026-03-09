import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCompetitorsTabData } from "./use-competitors-tab-data";

const { mockUsePlan, mockUseApiSWR } = vi.hoisted(() => ({
  mockUsePlan: vi.fn(),
  mockUseApiSWR: vi.fn(),
}));

vi.mock("@/hooks/use-plan", () => ({
  usePlan: () => mockUsePlan(),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => mockUseApiSWR(...args),
}));

describe("useCompetitorsTabData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePlan.mockReturnValue({ plan: "starter", isStarter: true });
  });

  it("loads benchmarks and strategy competitors while deriving lookup state", () => {
    const mutateBenchmarks = vi.fn();
    const mutateStrategy = vi.fn();

    mockUseApiSWR.mockImplementation((key: string) => {
      if (key === "benchmarks-proj-1") {
        return {
          data: {
            projectScores: { overall: 80 },
            competitors: [
              {
                competitorDomain: "example.com",
                crawledAt: "2024-01-01T00:00:00.000Z",
                scores: { overall: 75 },
                comparison: { overall: 5 },
              },
            ],
          },
          isLoading: false,
          mutate: mutateBenchmarks,
        };
      }

      return {
        data: [
          {
            id: "comp-1",
            projectId: "proj-1",
            domain: "example.com",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        mutate: mutateStrategy,
      };
    });

    const { result } = renderHook(() =>
      useCompetitorsTabData({ projectId: "proj-1" }),
    );

    expect(result.current.isStarter).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.competitors).toHaveLength(1);
    expect(result.current.projectScores?.overall).toBe(80);
    expect(result.current.competitorDomains).toEqual(["example.com"]);
    expect(result.current.strategyByDomain.get("example.com")?.id).toBe(
      "comp-1",
    );
    expect(result.current.trendCompetitors).toEqual([
      { domain: "example.com", id: "comp-1" },
    ]);
    expect(result.current.mutateBenchmarks).toBe(mutateBenchmarks);
    expect(result.current.mutateStrategy).toBe(mutateStrategy);
  });

  it("falls back to empty collections when data has not loaded", () => {
    mockUseApiSWR.mockReturnValue({
      data: undefined,
      isLoading: true,
      mutate: vi.fn(),
    });

    const { result } = renderHook(() =>
      useCompetitorsTabData({ projectId: "proj-1" }),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.competitors).toEqual([]);
    expect(result.current.competitorDomains).toEqual([]);
    expect(result.current.trendCompetitors).toEqual([]);
  });
});
