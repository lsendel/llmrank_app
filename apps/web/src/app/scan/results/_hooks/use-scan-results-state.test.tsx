import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth-hooks";
import {
  applyProjectWorkspaceDefaults,
  deriveProjectName,
} from "@/lib/project-workspace-defaults";
import { track } from "@/lib/telemetry";
import { useScanResultsState } from "./use-scan-results-state";

const pushMock = vi.fn();
const replaceMock = vi.fn();

let currentSearchParams = new URLSearchParams("id=scan-1");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  useSearchParams: () => ({
    get: (key: string) => currentSearchParams.get(key),
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    public: {
      getScanResult: vi.fn(),
    },
    projects: {
      create: vi.fn(),
    },
  },
  ApiError: class ApiError extends Error {},
}));

vi.mock("@/lib/auth-hooks", () => ({
  useUser: vi.fn(() => ({ isSignedIn: false, isLoaded: true, user: null })),
}));

vi.mock("@/lib/project-workspace-defaults", () => ({
  applyProjectWorkspaceDefaults: vi.fn(),
  deriveProjectName: vi.fn(() => "Example Project"),
}));

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

const baseResult = {
  url: "https://example.com",
  domain: "example.com",
  createdAt: "2024-03-10T00:00:00.000Z",
  scores: {
    overall: 72,
    technical: 70,
    content: 75,
    aiReadiness: 68,
    performance: 74,
    letterGrade: "B",
  },
  issues: [],
  meta: {
    title: "Example | AI SEO",
    description: "Example description",
    wordCount: 500,
    hasLlmsTxt: false,
    hasSitemap: true,
    sitemapUrls: 0,
    aiCrawlersBlocked: [],
    schemaTypes: [],
    ogTags: {},
  },
  visibility: [{ provider: "claude", brandMentioned: true, urlCited: false }],
};

describe("useScanResultsState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams("id=scan-1");
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(useUser).mockReturnValue({
      isSignedIn: false,
      isLoaded: true,
      user: null,
    });
    vi.mocked(api.public.getScanResult).mockResolvedValue(baseResult as never);
  });

  it("loads API results, derives visibility data, and tracks completion", async () => {
    const { result } = renderHook(() => useScanResultsState());

    await waitFor(() =>
      expect(result.current.result?.domain).toBe("example.com"),
    );

    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.visibilityProviders).toEqual(["claude"]);
    expect(result.current.anyVisibilityMention).toBe(true);
    expect(result.current.recurringScanDestination).toBe("/pricing");
    expect(track).toHaveBeenCalledWith(
      "scan.completed",
      expect.objectContaining({
        domain: "https://example.com",
        grade: "B",
        score: 72,
      }),
    );
  });

  it("persists unlock tokens and refetches unlocked results", async () => {
    const { result } = renderHook(() => useScanResultsState());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleEmailCaptured("lead-1");
    });

    await waitFor(() => {
      expect(localStorage.getItem("scan-unlocked-scan-1")).toBe("lead-1");
      expect(api.public.getScanResult).toHaveBeenLastCalledWith(
        "scan-1",
        "lead-1",
      );
    });
  });

  it("creates a workspace for signed-in users and redirects to the new project", async () => {
    vi.mocked(useUser).mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
      user: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        image: null,
      },
    });
    vi.mocked(api.projects.create).mockResolvedValue({ id: "proj-1" } as never);
    vi.mocked(applyProjectWorkspaceDefaults).mockResolvedValue({
      failed: [],
      digestEnabled: true,
    });

    const { result } = renderHook(() => useScanResultsState());

    await waitFor(() =>
      expect(result.current.result?.domain).toBe("example.com"),
    );

    await act(async () => {
      await result.current.handleCreateWorkspaceFromScan();
    });

    expect(deriveProjectName).toHaveBeenCalledWith(
      "https://example.com",
      "Example | AI SEO",
    );
    expect(api.projects.create).toHaveBeenCalledWith({
      name: "Example Project",
      domain: "example.com",
    });
    expect(applyProjectWorkspaceDefaults).toHaveBeenCalledWith({
      projectId: "proj-1",
      domainOrUrl: "https://example.com",
      title: "Example | AI SEO",
    });
    expect(pushMock).toHaveBeenCalledWith(
      "/dashboard/projects/proj-1?tab=overview&source=scan",
    );
  });

  it("loads full results from sessionStorage when no scan id is present", async () => {
    currentSearchParams = new URLSearchParams("");
    sessionStorage.setItem(
      "scanResult",
      JSON.stringify({
        ...baseResult,
        quickWins: [
          {
            code: "FIX_LLMS_TXT",
            category: "AI Readiness",
            severity: "warning",
            scoreImpact: 8,
            effortLevel: "low",
            message: "Add llms.txt",
            recommendation: "Publish an llms.txt file.",
            priority: 1,
            affectedPages: 1,
          },
        ],
      }),
    );

    const { result } = renderHook(() => useScanResultsState());

    await waitFor(() =>
      expect(result.current.result?.domain).toBe("example.com"),
    );

    expect(result.current.isUnlocked).toBe(true);
    expect(replaceMock).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith(
      "scan.completed",
      expect.objectContaining({
        domain: "https://example.com",
        grade: "B",
        score: 72,
      }),
    );
  });
});
