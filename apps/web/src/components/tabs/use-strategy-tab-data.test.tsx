import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  StrategyCompetitor,
  StrategyPersona,
  VisibilityGap,
} from "@/lib/api";
import { useStrategyTabData } from "./use-strategy-tab-data";

const {
  mockUseApiSWR,
  mockUseCompetitors,
  mockUsePersonas,
  mutatePersistedPersonas,
  mutateSavedKeywords,
  mutateVisibilitySchedules,
} = vi.hoisted(() => ({
  mockUseApiSWR: vi.fn(),
  mockUseCompetitors: vi.fn(),
  mockUsePersonas: vi.fn(),
  mutatePersistedPersonas: vi.fn(async () => undefined),
  mutateSavedKeywords: vi.fn(async () => undefined),
  mutateVisibilitySchedules: vi.fn(async () => undefined),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => mockUseApiSWR(...args),
}));

vi.mock("@/hooks/use-strategy", () => ({
  useCompetitors: (...args: unknown[]) => mockUseCompetitors(...args),
  usePersonas: (...args: unknown[]) => mockUsePersonas(...args),
}));

function configureSWR(overrides?: {
  topicMap?: unknown;
  persistedPersonas?: Array<{ name: string; role: string }> | undefined;
  savedKeywords?: Array<{ keyword: string }> | undefined;
  visibilitySchedules?: unknown[] | undefined;
  visibilityGaps?: VisibilityGap[] | undefined;
}) {
  mockUseApiSWR.mockImplementation((key: string) => {
    if (key === "topic-map-proj-1") {
      return { data: overrides?.topicMap };
    }
    if (key === "demand-personas-proj-1") {
      return {
        data: overrides?.persistedPersonas,
        mutate: mutatePersistedPersonas,
      };
    }
    if (key === "demand-keywords-proj-1") {
      return { data: overrides?.savedKeywords, mutate: mutateSavedKeywords };
    }
    if (key === "demand-schedules-proj-1") {
      return {
        data: overrides?.visibilitySchedules,
        mutate: mutateVisibilitySchedules,
      };
    }
    if (key === "demand-gaps-proj-1") {
      return { data: overrides?.visibilityGaps };
    }
    return { data: undefined };
  });
}

describe("useStrategyTabData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns strategy data and derives recommended competitor domains", () => {
    const competitors = [
      {
        id: "comp-1",
        projectId: "proj-1",
        domain: "existing.com",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ] satisfies StrategyCompetitor[];
    const personas = [
      {
        name: "Ops Leader",
        role: "Director",
        demographics: "B2B SaaS",
        goals: ["Improve AI visibility"],
        pains: ["Limited resources"],
        keywords: ["ai seo"],
        typicalQueries: ["best ai seo tools"],
      },
    ] satisfies StrategyPersona[];
    const generatePersonas = vi.fn(async () => personas);
    const addCompetitor = vi.fn(async () => undefined);
    const removeCompetitor = vi.fn(async () => undefined);

    mockUseCompetitors.mockReturnValue({
      competitors,
      addCompetitor,
      removeCompetitor,
    });
    mockUsePersonas.mockReturnValue({
      personas,
      generating: false,
      error: null,
      generatePersonas,
    });
    configureSWR({
      topicMap: { nodes: [{ id: "topic-1" }], edges: [] },
      persistedPersonas: [{ name: "Ops Leader", role: "Director" }],
      savedKeywords: [{ keyword: "ai seo" }],
      visibilitySchedules: [{ id: "schedule-1" }],
      visibilityGaps: [
        {
          query: "best ai seo tools",
          providers: ["chatgpt"],
          userMentioned: false,
          userCited: false,
          competitorsCited: [
            { domain: "existing.com", position: 1 },
            { domain: "other.com", position: 2 },
            { domain: "Other.com", position: 3 },
            { domain: "third.com", position: null },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useStrategyTabData("proj-1"));

    expect(result.current.topicMap).toEqual({
      nodes: [{ id: "topic-1" }],
      edges: [],
    });
    expect(result.current.competitors).toBe(competitors);
    expect(result.current.personas).toBe(personas);
    expect(result.current.generatePersonas).toBe(generatePersonas);
    expect(result.current.persistedPersonas).toEqual([
      { name: "Ops Leader", role: "Director" },
    ]);
    expect(result.current.savedKeywords).toEqual([{ keyword: "ai seo" }]);
    expect(result.current.visibilitySchedules).toEqual([{ id: "schedule-1" }]);
    expect(result.current.recommendedCompetitorDomains).toEqual([
      "other.com",
      "third.com",
    ]);
    expect(result.current.addCompetitor).toBe(addCompetitor);
    expect(result.current.removeCompetitor).toBe(removeCompetitor);
    expect(result.current.mutatePersistedPersonas).toBe(
      mutatePersistedPersonas,
    );
    expect(result.current.mutateSavedKeywords).toBe(mutateSavedKeywords);
    expect(result.current.mutateVisibilitySchedules).toBe(
      mutateVisibilitySchedules,
    );
  });

  it("falls back safely when strategy data is still unavailable", () => {
    mockUseCompetitors.mockReturnValue({
      competitors: undefined,
      addCompetitor: vi.fn(async () => undefined),
      removeCompetitor: vi.fn(async () => undefined),
    });
    mockUsePersonas.mockReturnValue({
      personas: [],
      generating: false,
      error: null,
      generatePersonas: vi.fn(async () => []),
    });
    configureSWR({
      topicMap: undefined,
      persistedPersonas: undefined,
      savedKeywords: undefined,
      visibilitySchedules: undefined,
      visibilityGaps: undefined,
    });

    const { result } = renderHook(() => useStrategyTabData("proj-1"));

    expect(result.current.topicMap).toBeUndefined();
    expect(result.current.competitors).toBeUndefined();
    expect(result.current.persistedPersonas).toBeUndefined();
    expect(result.current.savedKeywords).toBeUndefined();
    expect(result.current.visibilitySchedules).toBeUndefined();
    expect(result.current.recommendedCompetitorDomains).toEqual([]);
  });
});
