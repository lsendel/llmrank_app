import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ScheduledQuery,
  type StrategyCompetitor,
  type VisibilityCheck,
  type VisibilityGap,
} from "@/lib/api";
import { useVisibilityTabData } from "./use-visibility-tab-data";

const { mockUseApiSWR } = vi.hoisted(() => ({
  mockUseApiSWR: vi.fn(),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => mockUseApiSWR(...args),
}));

function configureSWR(overrides?: {
  competitors?: StrategyCompetitor[];
  defaultGaps?: VisibilityGap[];
  regionalGaps?: VisibilityGap[];
  history?: VisibilityCheck[];
  historyLoading?: boolean;
  schedules?: ScheduledQuery[];
  schedulesLoading?: boolean;
}) {
  const mutateFn = vi.fn();
  mockUseApiSWR.mockImplementation((key: string) => {
    if (typeof key === "string" && key.startsWith("competitors-")) {
      return { data: overrides?.competitors };
    }
    if (typeof key === "string" && key.startsWith("visibility-gaps-")) {
      if (key.includes("-us-en")) {
        return { data: overrides?.regionalGaps };
      }
      return { data: overrides?.defaultGaps };
    }
    if (typeof key === "string" && key.startsWith("visibility-history-")) {
      return {
        data: overrides?.history,
        isLoading: overrides?.historyLoading ?? false,
        mutate: mutateFn,
      };
    }
    if (typeof key === "string" && key.startsWith("visibility-schedules-")) {
      return {
        data: overrides?.schedules,
        isLoading: overrides?.schedulesLoading ?? false,
        mutate: mutateFn,
      };
    }
    return { data: undefined, isLoading: false, mutate: mutateFn };
  });
  return mutateFn;
}

describe("useVisibilityTabData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads visibility data and derives freshness metadata", async () => {
    const history = [
      {
        id: "check-1",
        projectId: "proj-1",
        llmProvider: "chatgpt",
        query: "best llm tools",
        brandMentioned: true,
        urlCited: true,
        citationPosition: 1,
        responseText: "response-1",
        competitorMentions: [],
        checkedAt: "2024-01-10T00:00:00.000Z",
      },
      {
        id: "check-2",
        projectId: "proj-1",
        llmProvider: "claude",
        query: "best llm tools",
        brandMentioned: true,
        urlCited: false,
        citationPosition: null,
        responseText: "response-2",
        competitorMentions: [],
        checkedAt: "2024-01-12T00:00:00.000Z",
      },
      {
        id: "check-3",
        projectId: "proj-1",
        llmProvider: "chatgpt",
        query: "compare llm tools",
        brandMentioned: false,
        urlCited: false,
        citationPosition: null,
        responseText: null,
        competitorMentions: null,
        checkedAt: "2024-01-11T00:00:00.000Z",
      },
    ] as VisibilityCheck[];
    const schedules = [
      {
        id: "sched-1",
        projectId: "proj-1",
        query: "best llm tools",
        providers: ["chatgpt"],
        frequency: "weekly",
        enabled: true,
        lastRunAt: null,
        nextRunAt: "2024-01-20T00:00:00.000Z",
        createdAt: "2024-01-10T00:00:00.000Z",
      },
    ] as ScheduledQuery[];
    const competitors = [
      {
        id: "comp-1",
        projectId: "proj-1",
        domain: "example.com",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "comp-2",
        projectId: "proj-1",
        domain: "other.com",
        createdAt: "2024-01-02T00:00:00.000Z",
      },
    ] as StrategyCompetitor[];
    const gaps = [
      {
        query: "compare llm tools",
        providers: ["chatgpt"],
        userMentioned: false,
        userCited: false,
        competitorsCited: [{ domain: "other.com", position: 1 }],
      },
    ] as VisibilityGap[];

    configureSWR({ competitors, defaultGaps: gaps, history, schedules });

    const { result } = renderHook(() =>
      useVisibilityTabData({ projectId: "proj-1", canFilterRegion: true }),
    );

    expect(result.current.selectedRegion).toBe("all");
    expect(result.current.regionFilter).toBeUndefined();
    expect(result.current.history).toEqual(history);
    expect(result.current.historyLoaded).toBe(true);
    expect(result.current.schedules).toEqual(schedules);
    expect(result.current.schedulesLoaded).toBe(true);
    expect(result.current.competitorDomains).toEqual([
      "example.com",
      "other.com",
    ]);
    expect(result.current.gaps).toEqual(gaps);
    expect(result.current.visibilityMeta).toEqual({
      checks: 3,
      providerCount: 2,
      queryCount: 2,
      latestCheckedAt: "2024-01-12T00:00:00.000Z",
      confidence: { label: "Low", variant: "destructive" },
    });
  });

  it("recomputes region-filtered data when the selected region changes", async () => {
    configureSWR({
      defaultGaps: [],
      regionalGaps: [],
      history: [],
      schedules: [],
    });

    const { result } = renderHook(() =>
      useVisibilityTabData({ projectId: "proj-1", canFilterRegion: true }),
    );

    expect(result.current.historyLoaded).toBe(true);

    act(() => {
      result.current.setSelectedRegion("us");
    });

    await waitFor(() => {
      expect(result.current.regionFilter).toEqual({
        region: "us",
        language: "en",
      });
    });

    expect(mockUseApiSWR).toHaveBeenCalledWith(
      "visibility-history-proj-1-us-en",
      expect.any(Function),
    );
    expect(mockUseApiSWR).toHaveBeenCalledWith(
      "visibility-gaps-proj-1-us-en",
      expect.any(Function),
    );
  });

  it("returns empty arrays and null meta when data is loading", () => {
    configureSWR({ historyLoading: true, schedulesLoading: true });

    const { result } = renderHook(() =>
      useVisibilityTabData({ projectId: "proj-1", canFilterRegion: true }),
    );

    expect(result.current.history).toEqual([]);
    expect(result.current.schedules).toEqual([]);
    expect(result.current.historyLoaded).toBe(false);
    expect(result.current.schedulesLoaded).toBe(false);
    expect(result.current.visibilityMeta).toBeNull();
  });
});
