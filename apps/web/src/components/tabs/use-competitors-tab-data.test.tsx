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
    const mutateInsights = vi.fn();

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

      if (key === "competitor-insights-proj-1") {
        return {
          data: [
            {
              competitorDomain: "example.com",
              winningQueries: [
                {
                  query: "ai seo software",
                  providers: ["chatgpt"],
                  wins: 2,
                  bestPosition: 1,
                  avgPosition: 1.5,
                  lastSeenAt: "2024-01-03T00:00:00.000Z",
                  yourMentioned: false,
                  yourCited: false,
                },
              ],
              inferredThemes: [
                {
                  label: "AI SEO",
                  source: "mixed",
                  evidence: ["AI SEO platform"],
                },
              ],
              homepageSignals: null,
            },
          ],
          mutate: mutateInsights,
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
    expect(result.current.competitorInsights).toHaveLength(1);
    expect(result.current.mutateBenchmarks).toBe(mutateBenchmarks);
    expect(result.current.mutateStrategy).toBe(mutateStrategy);
    expect(result.current.mutateInsights).toBe(mutateInsights);
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
