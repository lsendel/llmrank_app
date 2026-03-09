import { describe, expect, it, vi } from "vitest";
import {
  ago,
  buildBenchmarkScoreRows,
  buildComparisonBadge,
  buildStrategyByDomain,
  buildTrendCompetitors,
  getStrategyCompetitorMeta,
} from "./competitors-tab-helpers";

describe("competitors-tab helpers", () => {
  it("formats relative timestamps across minute and day ranges", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T12:00:00.000Z"));

    expect(ago("2024-01-10T11:45:00.000Z")).toBe("15m ago");
    expect(ago("2024-01-08T12:00:00.000Z")).toBe("2d ago");
    expect(ago(null)).toBe("Never");

    vi.useRealTimers();
  });

  it("builds score rows and comparison badges for benchmark cards", () => {
    expect(
      buildBenchmarkScoreRows(
        {
          overall: 82,
          technical: 75,
          content: 78,
          aiReadiness: 88,
          performance: 70,
        },
        {
          competitorDomain: "example.com",
          crawledAt: "2024-01-01T00:00:00.000Z",
          scores: {
            overall: 76,
            technical: 72,
            content: 80,
            aiReadiness: 75,
            performance: 68,
          },
          comparison: {
            overall: 6,
            technical: 3,
            content: -2,
            aiReadiness: 13,
            performance: 2,
          },
        },
      ),
    ).toEqual([
      {
        key: "overall",
        label: "Overall",
        yourScore: 82,
        theirScore: 76,
        delta: 6,
      },
      {
        key: "technical",
        label: "Technical",
        yourScore: 75,
        theirScore: 72,
        delta: 3,
      },
      {
        key: "content",
        label: "Content",
        yourScore: 78,
        theirScore: 80,
        delta: -2,
      },
      {
        key: "aiReadiness",
        label: "AI Readiness",
        yourScore: 88,
        theirScore: 75,
        delta: 13,
      },
      {
        key: "performance",
        label: "Performance",
        yourScore: 70,
        theirScore: 68,
        delta: 2,
      },
    ]);

    expect(buildComparisonBadge(4)).toEqual({
      label: "You lead",
      variant: "success",
    });
    expect(buildComparisonBadge(-1)).toEqual({
      label: "They lead",
      variant: "destructive",
    });
    expect(buildComparisonBadge(0)).toEqual({
      label: "Tied",
      variant: "secondary",
    });
  });

  it("derives strategy lookup, monitoring metadata, and trends competitors", () => {
    const strategyByDomain = buildStrategyByDomain([
      {
        id: "comp-1",
        projectId: "proj-1",
        domain: "example.com",
        createdAt: "2024-01-01T00:00:00.000Z",
        monitoringEnabled: false,
        lastBenchmarkAt: "2024-01-09T12:00:00.000Z",
      } as never,
    ]);

    expect(
      getStrategyCompetitorMeta(strategyByDomain.get("example.com")),
    ).toEqual({
      competitorId: "comp-1",
      monitoringEnabled: false,
      lastBenchmarkAt: "2024-01-09T12:00:00.000Z",
    });

    expect(
      buildTrendCompetitors(
        [
          {
            competitorDomain: "example.com",
            crawledAt: "2024-01-01T00:00:00.000Z",
            scores: {},
            comparison: {},
          },
        ],
        strategyByDomain,
      ),
    ).toEqual([{ domain: "example.com", id: "comp-1" }]);
  });
});
