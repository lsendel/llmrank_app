import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useAIVisibilityTabActions } from "./use-ai-visibility-tab-actions";

const { toastMock, withAuthMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  withAuthMock: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/use-api", () => ({
  useApi: () => ({ withAuth: withAuthMock }),
}));

describe("useAIVisibilityTabActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withAuthMock.mockImplementation((fn: () => Promise<unknown>) => fn());
    api.visibility.discoverKeywords = vi.fn(async () => ({
      gscKeywords: [],
      llmKeywords: [],
    }));
    api.keywords.createBatch = vi.fn(async () => []);
  });

  it("discovers keywords and stores the result", async () => {
    api.visibility.discoverKeywords = vi.fn(async () => ({
      gscKeywords: [{ keyword: "ai seo", source: "gsc", impressions: 123 }],
      llmKeywords: ["llm rank reviews"],
    }));

    const { result } = renderHook(() =>
      useAIVisibilityTabActions({ projectId: "proj-1", gaps: [] }),
    );

    await act(async () => {
      await result.current.handleDiscover();
    });

    expect(api.visibility.discoverKeywords).toHaveBeenCalledWith("proj-1");
    expect(result.current.discoveryResult).toEqual({
      gscKeywords: [{ keyword: "ai seo", source: "gsc", impressions: 123 }],
      llmKeywords: ["llm rank reviews"],
    });
    expect(result.current.discovering).toBe(false);
  });

  it("tracks visibility gaps as keywords and shows success feedback", async () => {
    api.keywords.createBatch = vi.fn(async () => [
      { id: "kw-1" },
      { id: "kw-2" },
    ]);

    const { result } = renderHook(() =>
      useAIVisibilityTabActions({
        projectId: "proj-1",
        gaps: [
          { query: "ai seo tools", competitorsCited: [] },
          { query: "llm rank alternatives", competitorsCited: [] },
        ] as never[],
      }),
    );

    await act(async () => {
      await result.current.handleTrackGapsAsKeywords();
    });

    expect(api.keywords.createBatch).toHaveBeenCalledWith("proj-1", [
      "ai seo tools",
      "llm rank alternatives",
    ]);
    expect(toastMock).toHaveBeenCalledWith({
      title: "Keywords saved",
      description: "2 gap queries added as tracked keywords.",
    });
    expect(result.current.trackingGaps).toBe(false);
  });

  it("shows a destructive toast when discovery fails", async () => {
    api.visibility.discoverKeywords = vi.fn(async () => {
      throw new Error("Boom");
    });

    const { result } = renderHook(() =>
      useAIVisibilityTabActions({ projectId: "proj-1", gaps: [] }),
    );

    await act(async () => {
      await result.current.handleDiscover();
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: "Keyword discovery failed",
      description: "Boom",
      variant: "destructive",
    });
    expect(result.current.discovering).toBe(false);
  });
});
