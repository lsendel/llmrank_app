import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  visibilityModeStorageKey,
  workspaceLastTabStorageKey,
} from "../project-page-helpers";
import { useProjectPageNavigation } from "./use-project-page-navigation";

const {
  mockPush,
  mockReplace,
  mockSearchParamsGet,
  mockSearchParamsToString,
  searchParamState,
} = vi.hoisted(() => {
  const state = {
    tab: "overview",
    configure: null as string | null,
    crawlId: null as string | null,
    connect: null as string | null,
    connected: null as string | null,
    autocrawl: null as string | null,
  };

  const getMock = vi.fn((key: string) => {
    if (key === "tab") return state.tab;
    if (key === "configure") return state.configure;
    if (key === "crawlId") return state.crawlId;
    if (key === "connect") return state.connect;
    if (key === "connected") return state.connected;
    if (key === "autocrawl") return state.autocrawl;
    return null;
  });

  const toStringMock = vi.fn(() => {
    const params = new URLSearchParams();
    if (state.tab) params.set("tab", state.tab);
    if (state.configure) params.set("configure", state.configure);
    if (state.crawlId) params.set("crawlId", state.crawlId);
    if (state.connect) params.set("connect", state.connect);
    if (state.connected) params.set("connected", state.connected);
    if (state.autocrawl) params.set("autocrawl", state.autocrawl);
    return params.toString();
  });

  return {
    mockPush: vi.fn(),
    mockReplace: vi.fn(),
    mockSearchParamsGet: getMock,
    mockSearchParamsToString: toStringMock,
    searchParamState: state,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
    toString: mockSearchParamsToString,
  }),
}));

describe("useProjectPageNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamState.tab = "overview";
    searchParamState.configure = null;
    searchParamState.crawlId = null;
    searchParamState.connect = null;
    searchParamState.connected = null;
    searchParamState.autocrawl = null;
    window.localStorage.clear();
  });

  it("normalizes an invalid tab query param", () => {
    searchParamState.tab = "bad-tab";

    renderHook(() => useProjectPageNavigation("proj-1"));

    expect(mockReplace).toHaveBeenCalledWith(
      "/dashboard/projects/proj-1?tab=overview",
    );
  });

  it("normalizes an invalid configure query param", () => {
    searchParamState.tab = "settings";
    searchParamState.configure = "bad-section";

    renderHook(() => useProjectPageNavigation("proj-1"));

    expect(mockReplace).toHaveBeenCalledWith(
      "/dashboard/projects/proj-1?tab=settings&configure=site-context",
    );
  });

  it("re-opens the last stored visibility mode when selecting visibility", () => {
    window.localStorage.setItem(
      visibilityModeStorageKey("proj-1"),
      "ai-analysis",
    );
    const { result } = renderHook(() => useProjectPageNavigation("proj-1"));

    act(() => {
      result.current.handleTabChange("visibility");
    });

    expect(mockPush).toHaveBeenCalledWith(
      "/dashboard/projects/proj-1?tab=ai-analysis",
    );
  });

  it("uses the stored workspace tab when switching workspaces", () => {
    window.localStorage.setItem(
      workspaceLastTabStorageKey("proj-1", "grow-visibility"),
      "ai-visibility",
    );
    const { result } = renderHook(() => useProjectPageNavigation("proj-1"));

    act(() => {
      result.current.handleWorkspaceChange("grow-visibility");
    });

    expect(mockPush).toHaveBeenCalledWith(
      "/dashboard/projects/proj-1?tab=ai-visibility",
    );
  });
});
