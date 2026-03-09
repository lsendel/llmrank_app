import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAIVisibilityTabData } from "./use-ai-visibility-tab-data";

const { mockUseApiSWR } = vi.hoisted(() => ({
  mockUseApiSWR: vi.fn(),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => mockUseApiSWR(...args),
}));

describe("useAIVisibilityTabData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads ai visibility datasets and derives summary state", () => {
    mockUseApiSWR.mockImplementation((key: string) => {
      if (key === "ai-score-proj-1") {
        return {
          data: { overall: 76, grade: "B", breakdown: {}, meta: {} },
          isLoading: false,
        };
      }
      if (key === "vis-checks-proj-1") {
        return {
          data: [
            {
              query: "best ai seo tools",
              llmProvider: "chatgpt",
              brandMentioned: true,
              checkedAt: "2024-01-01T00:00:00.000Z",
            },
            {
              query: "best ai seo tools",
              llmProvider: "claude",
              brandMentioned: false,
              checkedAt: "2024-01-02T00:00:00.000Z",
            },
            {
              query: "llm rank alternatives",
              llmProvider: "gemini_ai_mode",
              brandMentioned: true,
              checkedAt: "2024-01-03T00:00:00.000Z",
            },
          ],
        };
      }
      if (key === "vis-gaps-proj-1") {
        return {
          data: [
            {
              query: "llm rank alternatives",
              competitorsCited: [{ domain: "example.com", position: 1 }],
            },
          ],
        };
      }
      if (key === "backlinks-proj-1") {
        return {
          data: { totalBacklinks: 12, referringDomains: 3, dofollowRatio: 0.5 },
          isLoading: false,
        };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useAIVisibilityTabData({ projectId: "proj-1" }),
    );

    expect(result.current.score?.overall).toBe(76);
    expect(result.current.llmChecks).toHaveLength(2);
    expect(result.current.aiModeChecks).toHaveLength(1);
    expect(result.current.llmMentionRate).toBe(50);
    expect(result.current.aiModeRate).toBe(100);
    expect(result.current.keywordRows).toHaveLength(2);
    expect(result.current.visibilityMeta).toEqual({
      checks: 3,
      providerCount: 3,
      queryCount: 2,
      latestCheckedAt: "2024-01-03T00:00:00.000Z",
      confidence: { label: "Low", variant: "destructive" },
    });
    expect(result.current.llmProviderCount).toBe(2);
    expect(result.current.gaps?.[0]?.query).toBe("llm rank alternatives");
    expect(result.current.blSummary?.totalBacklinks).toBe(12);
  });

  it("returns empty derived state when checks have not loaded yet", () => {
    mockUseApiSWR.mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(() =>
      useAIVisibilityTabData({ projectId: "proj-1" }),
    );

    expect(result.current.checks).toBeUndefined();
    expect(result.current.keywordRows).toEqual([]);
    expect(result.current.visibilityMeta).toBeNull();
    expect(result.current.llmMentionRate).toBe(0);
    expect(result.current.aiModeRate).toBe(0);
  });
});
