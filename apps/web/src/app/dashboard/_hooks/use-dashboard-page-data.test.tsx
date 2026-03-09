import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DASHBOARD_LAST_VISIT_KEY } from "../dashboard-page-helpers";
import { useDashboardPageData } from "./use-dashboard-page-data";

const {
  mockShouldShowPersonaModal,
  mockTrack,
  mockUseDashboardStats,
  mockUseRecentActivity,
  mockUsePersonaLayout,
  mockUseApiSWR,
  mockGetLastProjectContext,
  mockSaveLastProjectContext,
  mockUpdatePreferences,
} = vi.hoisted(() => ({
  mockShouldShowPersonaModal: vi.fn(),
  mockTrack: vi.fn(),
  mockUseDashboardStats: vi.fn(),
  mockUseRecentActivity: vi.fn(),
  mockUsePersonaLayout: vi.fn(),
  mockUseApiSWR: vi.fn(),
  mockGetLastProjectContext: vi.fn(),
  mockSaveLastProjectContext: vi.fn(),
  mockUpdatePreferences: vi.fn(),
}));

vi.mock("@/components/persona-discovery-modal", () => ({
  shouldShowPersonaModal: mockShouldShowPersonaModal,
}));

vi.mock("@/lib/auth-hooks", () => ({
  useUser: () => ({ user: { name: "Taylor Swift" } }),
}));

vi.mock("@/hooks/use-dashboard", () => ({
  useDashboardStats: mockUseDashboardStats,
  useRecentActivity: mockUseRecentActivity,
}));

vi.mock("@/hooks/use-persona-layout", () => ({
  usePersonaLayout: mockUsePersonaLayout,
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: mockUseApiSWR,
}));

vi.mock("@/lib/telemetry", () => ({
  track: mockTrack,
}));

vi.mock("@/lib/api", () => ({
  api: {
    account: {
      getPreferences: vi.fn(),
      getMe: vi.fn(),
      updatePreferences: mockUpdatePreferences,
    },
  },
}));

vi.mock("@/lib/workflow-memory", async () => {
  const actual = await vi.importActual<typeof import("@/lib/workflow-memory")>(
    "@/lib/workflow-memory",
  );
  return {
    ...actual,
    getLastProjectContext: mockGetLastProjectContext,
    saveLastProjectContext: mockSaveLastProjectContext,
  };
});

describe("useDashboardPageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-15T12:00:00.000Z"));
    window.localStorage.clear();
    window.localStorage.setItem(
      DASHBOARD_LAST_VISIT_KEY,
      "2024-03-10T00:00:00.000Z",
    );

    mockUseDashboardStats.mockReturnValue({
      data: {
        totalProjects: 3,
        totalCrawls: 5,
        avgScore: 81,
        creditsRemaining: 90,
        creditsTotal: 200,
        latestInsights: {
          quickWins: [],
          coverage: [],
          scoreDeltas: {
            overall: 0,
            technical: 0,
            content: 0,
            aiReadiness: 0,
            performance: 0,
          },
        },
      },
      isLoading: false,
    });
    mockUseRecentActivity.mockReturnValue({
      data: [
        {
          projectId: "proj-1",
          projectName: "Alpha",
          status: "complete",
          completedAt: "2024-03-13T08:00:00.000Z",
          createdAt: "2024-03-13T07:00:00.000Z",
        },
        {
          projectId: "proj-2",
          projectName: "Beta",
          status: "failed",
          completedAt: "2024-03-14T09:00:00.000Z",
          createdAt: "2024-03-14T08:00:00.000Z",
        },
      ],
      isLoading: false,
    });
    mockUsePersonaLayout.mockReturnValue({
      widgetOrder: ["stats", "activity"],
      isPersonalized: true,
    });
    mockShouldShowPersonaModal.mockReturnValue(true);
    mockUseApiSWR.mockImplementation((key: string) => {
      if (key === "account-preferences") {
        return {
          data: {
            dashboardLastVisitedAt: "2024-03-12T00:00:00.000Z",
            lastProjectContext: {
              projectId: "proj-2",
              tab: "visibility",
              projectName: "Beta",
              domain: "beta.example.com",
              visitedAt: "2024-03-14T10:00:00.000Z",
            },
          },
          isLoading: false,
        };
      }

      return {
        data: {
          persona: null,
          isAdmin: true,
        },
        isLoading: false,
      };
    });
    mockGetLastProjectContext.mockReturnValue({
      projectId: "proj-1",
      tab: "overview",
      projectName: "Alpha",
      domain: "alpha.example.com",
      visitedAt: "2024-03-11T10:00:00.000Z",
    });
    mockUpdatePreferences.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives dashboard state, syncs preferences, and tracks load", () => {
    const { result } = renderHook(() => useDashboardPageData());

    expect(result.current.firstName).toBe("Taylor");
    expect(result.current.loading).toBe(false);
    expect(result.current.effectiveLastVisitAt).toBe(
      "2024-03-12T00:00:00.000Z",
    );
    expect(result.current.personaModalOpen).toBe(true);
    expect(result.current.lastProjectContext).toMatchObject({
      projectId: "proj-2",
      tab: "visibility",
    });
    expect(result.current.sinceLastVisit).toMatchObject({
      completed: 1,
      failed: 1,
      inProgress: 0,
      projectsTouched: 2,
      feedEvents: 2,
    });
    expect(mockSaveLastProjectContext).toHaveBeenCalledWith({
      projectId: "proj-2",
      tab: "visibility",
      projectName: "Beta",
      domain: "beta.example.com",
      visitedAt: "2024-03-14T10:00:00.000Z",
    });
    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      dashboardLastVisitedAt: "2024-03-15T12:00:00.000Z",
    });
    expect(mockTrack).toHaveBeenCalledWith("dashboard_loaded", {
      persona: null,
      isPersonalized: true,
      widgetOrder: "stats,activity",
    });

    act(() => {
      result.current.closePersonaModal();
    });

    expect(result.current.personaModalOpen).toBe(false);
  });

  it("persists banner dismissal and tracks widget clicks", () => {
    const { result } = renderHook(() => useDashboardPageData());

    expect(result.current.bannerDismissed).toBe(false);
    act(() => {
      result.current.dismissBanner();
    });

    expect(result.current.bannerDismissed).toBe(true);
    expect(window.localStorage.getItem("ai-features-banner-dismissed")).toBe(
      "1",
    );

    mockTrack.mockClear();

    act(() => {
      result.current.handleWidgetClick("stats");
    });

    expect(mockTrack).toHaveBeenCalledWith("dashboard_widget_clicked", {
      widgetId: "stats",
      persona: null,
      isPersonalized: true,
    });
  });
});
