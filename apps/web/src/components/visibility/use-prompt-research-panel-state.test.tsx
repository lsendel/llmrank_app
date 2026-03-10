import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIPrompt } from "@/lib/api";
import { usePromptResearchPanelState } from "./use-prompt-research-panel-state";

const mutateMock = vi.fn().mockResolvedValue(undefined);
const toastMock = vi.fn();
const useApiSWRMock = vi.fn();
const discoverMock = vi.fn();
const removeMock = vi.fn();
const checkMock = vi.fn();
const trackScheduleMock = vi.fn();

const prompt: AIPrompt = {
  id: "prompt-1",
  projectId: "proj-1",
  prompt: "best ai seo tools for saas",
  category: "comparison",
  estimatedVolume: 1200,
  difficulty: 48,
  intent: "informational",
  yourMentioned: false,
  competitorsMentioned: ["competitor.com"],
  source: "discovered",
  discoveredAt: new Date().toISOString(),
};

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => useApiSWRMock(...args),
}));

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  api: {
    promptResearch: {
      list: vi.fn(),
      discover: (...args: unknown[]) => discoverMock(...args),
      remove: (...args: unknown[]) => removeMock(...args),
      check: (...args: unknown[]) => checkMock(...args),
    },
    visibility: {
      schedules: {
        create: (...args: unknown[]) => trackScheduleMock(...args),
      },
    },
  },
}));

describe("usePromptResearchPanelState", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useApiSWRMock.mockReturnValue({
      data: { data: [prompt], meta: { limit: 20, plan: "starter" } },
      isLoading: false,
      error: null,
      mutate: mutateMock,
    });
    discoverMock.mockResolvedValue([prompt]);
    removeMock.mockResolvedValue(undefined);
    checkMock.mockResolvedValue({
      promptId: prompt.id,
      prompt: prompt.prompt,
      checkCount: 1,
      yourMentioned: true,
      competitorsMentioned: ["competitor.com"],
      checks: [],
    });
    trackScheduleMock.mockResolvedValue({ id: "schedule-1" });
  });

  it("discovers prompts and refreshes data", async () => {
    const { result } = renderHook(() =>
      usePromptResearchPanelState({ projectId: "proj-1" }),
    );

    await act(async () => {
      await result.current.handleDiscover();
    });

    expect(discoverMock).toHaveBeenCalledWith("proj-1");
    expect(mutateMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Prompts discovered" }),
    );
  });

  it("passes locale filters to prompt checks", async () => {
    const { result } = renderHook(() =>
      usePromptResearchPanelState({
        projectId: "proj-1",
        filters: { region: "gb", language: "en" },
      }),
    );

    await act(async () => {
      await result.current.handleRunCheck(prompt);
    });

    expect(checkMock).toHaveBeenCalledWith({
      projectId: "proj-1",
      promptId: "prompt-1",
      region: "gb",
      language: "en",
    });
    expect(mutateMock).toHaveBeenCalled();
  });

  it("tracks and removes prompts", async () => {
    const { result } = renderHook(() =>
      usePromptResearchPanelState({ projectId: "proj-1" }),
    );

    await waitFor(() => {
      expect(result.current.prompts).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleTrackPrompt(prompt);
    });

    expect(trackScheduleMock).toHaveBeenCalledWith({
      projectId: "proj-1",
      query: "best ai seo tools for saas",
      providers: ["chatgpt", "claude", "perplexity", "gemini"],
      frequency: "weekly",
    });

    await act(async () => {
      await result.current.handleDelete("prompt-1");
    });

    expect(removeMock).toHaveBeenCalledWith("proj-1", "prompt-1");
    expect(mutateMock).toHaveBeenCalled();
  });
});
