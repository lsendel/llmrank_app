import { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  ApiError,
  type ScheduledQuery,
  type VisibilityCheck,
} from "@/lib/api";
import { buildRegionFilter } from "./visibility-tab-helpers";
import { useVisibilityTabActions } from "./use-visibility-tab-actions";

const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/use-api", () => ({
  useApi: () => ({
    withAuth: async <T,>(fn: () => Promise<T>) => fn(),
  }),
}));

describe("useVisibilityTabActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.keywords.createBatch = vi.fn(async () => []);
    api.visibility.run = vi.fn(async () => []);
    api.visibility.list = vi.fn(async () => []);
    api.visibility.schedules.create = vi.fn(async () => ({}) as ScheduledQuery);
    api.visibility.schedules.update = vi.fn(async () => ({}) as ScheduledQuery);
    api.visibility.schedules.delete = vi.fn(async () => undefined);
  });

  it("saves persona queries, runs visibility checks, and refreshes history", async () => {
    const runResult = [
      {
        id: "run-1",
        query: "best llm tools",
        llmProvider: "chatgpt",
        brandMentioned: true,
        urlCited: true,
        citationPosition: 1,
        responseText: "response",
        competitorMentions: [],
        checkedAt: "2024-01-10T00:00:00.000Z",
      },
    ] as VisibilityCheck[];
    const historyResult = [
      {
        id: "hist-1",
        query: "best llm tools",
        llmProvider: "claude",
        brandMentioned: false,
        urlCited: false,
        citationPosition: null,
        responseText: null,
        competitorMentions: null,
        checkedAt: "2024-01-11T00:00:00.000Z",
      },
    ] as VisibilityCheck[];

    api.keywords.createBatch = vi.fn(async () => [{ id: "saved-kw" }]);
    api.visibility.run = vi.fn(async () => runResult);
    api.visibility.list = vi.fn(async () => historyResult);

    const { result } = renderHook(() => {
      const [selectedRegion, setSelectedRegion] = useState("all");
      const [history, setHistory] = useState<VisibilityCheck[]>([]);
      const [schedules, setSchedules] = useState<ScheduledQuery[]>([]);
      const actions = useVisibilityTabActions({
        projectId: "proj-1",
        canFilterRegion: true,
        isProOrAbove: true,
        regionFilter: buildRegionFilter(selectedRegion, true),
        setSelectedRegion,
        setHistory,
        setSchedules,
      });

      return { selectedRegion, history, schedules, ...actions };
    });

    act(() => {
      result.current.handleSelectRegion("us");
      result.current.setSelectedKeywordIds([
        "kw-1",
        "persona:ops-leader:best llm tools",
      ]);
    });

    await act(async () => {
      await result.current.handleRunCheck();
    });

    expect(api.keywords.createBatch).toHaveBeenCalledWith("proj-1", [
      "best llm tools",
    ]);
    expect(api.visibility.run).toHaveBeenCalledWith({
      projectId: "proj-1",
      keywordIds: ["kw-1", "saved-kw"],
      providers: [
        "chatgpt",
        "claude",
        "perplexity",
        "gemini",
        "copilot",
        "gemini_ai_mode",
        "grok",
      ],
      region: "us",
      language: "en",
    });
    expect(result.current.results).toEqual(runResult);
    expect(result.current.history).toEqual(historyResult);
  });

  it("creates, toggles, and deletes schedules while updating local state", async () => {
    const created = {
      id: "sched-1",
      projectId: "proj-1",
      query: "best llm tools",
      providers: ["chatgpt"],
      frequency: "weekly",
      enabled: true,
      lastRunAt: null,
      nextRunAt: "2024-01-20T00:00:00.000Z",
      createdAt: "2024-01-10T00:00:00.000Z",
    } as ScheduledQuery;
    const toggled = { ...created, enabled: false } as ScheduledQuery;

    api.visibility.schedules.create = vi.fn(async () => created);
    api.visibility.schedules.update = vi.fn(async () => toggled);

    const { result } = renderHook(() => {
      const [selectedRegion, setSelectedRegion] = useState("all");
      const [history, setHistory] = useState<VisibilityCheck[]>([]);
      const [schedules, setSchedules] = useState<ScheduledQuery[]>([]);
      const actions = useVisibilityTabActions({
        projectId: "proj-1",
        canFilterRegion: true,
        isProOrAbove: true,
        regionFilter: buildRegionFilter(selectedRegion, true),
        setSelectedRegion,
        setHistory,
        setSchedules,
      });

      return { selectedRegion, history, schedules, ...actions };
    });

    await act(async () => {
      await result.current.handleCreateSchedule({
        query: "best llm tools",
        providers: ["chatgpt"],
        frequency: "weekly",
      });
    });

    expect(result.current.schedules).toEqual([created]);

    await act(async () => {
      await result.current.handleToggleSchedule(created);
    });

    expect(result.current.schedules).toEqual([toggled]);

    await act(async () => {
      await result.current.handleDeleteSchedule(created.id);
    });

    expect(api.visibility.schedules.delete).toHaveBeenCalledWith("sched-1");
    expect(result.current.schedules).toEqual([]);
  });

  it("applies provider presets and intent recommendations", () => {
    const { result } = renderHook(() => {
      const [selectedRegion, setSelectedRegion] = useState("all");
      const [history, setHistory] = useState<VisibilityCheck[]>([]);
      const [schedules, setSchedules] = useState<ScheduledQuery[]>([]);
      const actions = useVisibilityTabActions({
        projectId: "proj-1",
        canFilterRegion: true,
        isProOrAbove: true,
        regionFilter: buildRegionFilter(selectedRegion, true),
        setSelectedRegion,
        setHistory,
        setSchedules,
      });

      return { selectedRegion, history, schedules, ...actions };
    });

    act(() => {
      result.current.handleApplyAiSearchPreset();
    });

    expect(result.current.selectedProviders).toEqual([
      "perplexity",
      "gemini",
      "gemini_ai_mode",
    ]);

    act(() => {
      result.current.setIntent("comparison");
    });

    act(() => {
      result.current.handleApplyIntentPreset();
    });

    expect(result.current.selectedProviders).toEqual([
      "perplexity",
      "gemini",
      "chatgpt",
      "grok",
    ]);
    expect(toastMock).toHaveBeenCalledWith({
      title: "Provider preset applied",
      description: "Loaded recommended providers for comparison intent.",
    });
  });

  it("blocks paid-only region and full-coverage actions when the plan is insufficient", () => {
    const { result } = renderHook(() => {
      const [selectedRegion, setSelectedRegion] = useState("all");
      const [history, setHistory] = useState<VisibilityCheck[]>([]);
      const [schedules, setSchedules] = useState<ScheduledQuery[]>([]);
      const actions = useVisibilityTabActions({
        projectId: "proj-1",
        canFilterRegion: false,
        isProOrAbove: false,
        regionFilter: buildRegionFilter(selectedRegion, false),
        setSelectedRegion,
        setHistory,
        setSchedules,
      });

      return { selectedRegion, history, schedules, ...actions };
    });

    act(() => {
      result.current.handleApplyAiSearchPreset();
      result.current.handleSelectRegion("us");
      result.current.handleApplyFullCoveragePreset();
    });

    expect(result.current.selectedRegion).toBe("all");
    expect(result.current.selectedProviders).toEqual([
      "perplexity",
      "gemini",
      "gemini_ai_mode",
    ]);
    expect(toastMock).toHaveBeenCalledWith({
      title: "Pro plan required",
      description: "Regional filtering is available on Pro and Agency plans.",
      variant: "destructive",
    });
    expect(toastMock).toHaveBeenCalledWith({
      title: "Pro plan required",
      description: "Full coverage preset is available on Pro and Agency plans.",
      variant: "destructive",
    });
  });

  it("surfaces run-check API errors as actionable state", async () => {
    api.visibility.run = vi.fn(async () => {
      throw new ApiError(429, "PLAN_LIMIT_REACHED", "Quota reached");
    });

    const { result } = renderHook(() => {
      const [selectedRegion, setSelectedRegion] = useState("all");
      const [history, setHistory] = useState<VisibilityCheck[]>([]);
      const [schedules, setSchedules] = useState<ScheduledQuery[]>([]);
      const actions = useVisibilityTabActions({
        projectId: "proj-1",
        canFilterRegion: true,
        isProOrAbove: true,
        regionFilter: buildRegionFilter(selectedRegion, true),
        setSelectedRegion,
        setHistory,
        setSchedules,
      });

      return { selectedRegion, history, schedules, ...actions };
    });

    act(() => {
      result.current.setSelectedKeywordIds(["kw-1"]);
    });

    await act(async () => {
      await result.current.handleRunCheck();
    });

    expect(result.current.error).toBe("Quota reached");
    expect(result.current.loading).toBe(false);
  });
});
