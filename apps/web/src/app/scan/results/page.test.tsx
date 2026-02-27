import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ScanResultsPage from "@/app/scan/results/page";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth-hooks";
import { track } from "@/lib/telemetry";
import { vi } from "vitest";

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => ({
    get: (key: string) => (key === "id" ? "scan-1" : null),
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    public: {
      getScanResult: vi.fn(),
    },
    projects: {
      create: vi.fn(),
      update: vi.fn(),
    },
    pipeline: {
      updateSettings: vi.fn(),
    },
    visibility: {
      schedules: {
        create: vi.fn(),
      },
    },
    account: {
      getDigestPreferences: vi.fn(),
      updateDigestPreferences: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth-hooks", () => ({
  useUser: vi.fn(() => ({ isSignedIn: false, isLoaded: true, user: null })),
}));

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

describe("Scan Results conversion actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUser).mockReturnValue({
      isSignedIn: false,
      isLoaded: true,
      user: null,
    });
  });

  it("tracks funnel events for primary and secondary next actions", async () => {
    vi.mocked(api.public.getScanResult).mockResolvedValue({
      url: "https://example.com",
      domain: "example.com",
      scores: {
        overall: 72,
        technical: 70,
        content: 75,
        aiReadiness: 68,
        performance: 74,
        letterGrade: "B",
      },
      issues: [],
      quickWins: [],
      meta: {
        title: "Example",
        description: "Example description",
        wordCount: 500,
        hasLlmsTxt: false,
        hasSitemap: true,
        sitemapUrls: 0,
        aiCrawlersBlocked: [],
        schemaTypes: [],
        ogTags: {},
      },
      visibility: null,
    });

    render(<ScanResultsPage />);

    await waitFor(() => {
      expect(api.public.getScanResult).toHaveBeenCalledWith(
        "scan-1",
        undefined,
      );
    });

    const createProject = await screen.findByRole("link", {
      name: "Create Project Workspace",
    });
    const connectIntegrations = screen.getByRole("link", {
      name: "Connect Integrations",
    });
    const scheduleRecurring = screen.getByRole("link", {
      name: "Schedule Recurring Scans",
    });

    fireEvent.click(createProject);
    fireEvent.click(connectIntegrations);
    fireEvent.click(scheduleRecurring);

    expect(track).toHaveBeenCalledWith(
      "scan_result_cta_clicked",
      expect.objectContaining({
        cta: "create_project",
        destination: "/sign-up",
        placement: "results_next_actions",
        scanResultId: "scan-1",
        domain: "https://example.com",
      }),
    );

    expect(track).toHaveBeenCalledWith(
      "scan_result_cta_clicked",
      expect.objectContaining({
        cta: "connect_integration",
        destination: "/integrations",
        placement: "results_next_actions",
      }),
    );

    expect(track).toHaveBeenCalledWith(
      "scan_result_cta_clicked",
      expect.objectContaining({
        cta: "schedule_recurring_scan",
        destination: "/pricing",
        placement: "results_next_actions",
      }),
    );
  });

  it("creates a workspace with defaults for signed-in users", async () => {
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

    vi.mocked(api.public.getScanResult).mockResolvedValue({
      url: "https://example.com",
      domain: "example.com",
      scores: {
        overall: 72,
        technical: 70,
        content: 75,
        aiReadiness: 68,
        performance: 74,
        letterGrade: "B",
      },
      issues: [],
      quickWins: [],
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
      visibility: null,
    });

    vi.mocked(api.projects.create).mockResolvedValue({
      id: "proj-1",
    } as never);
    vi.mocked(api.projects.update).mockResolvedValue({} as never);
    vi.mocked(api.pipeline.updateSettings).mockResolvedValue({} as never);
    vi.mocked(api.visibility.schedules.create).mockResolvedValue({} as never);
    vi.mocked(api.account.getDigestPreferences).mockResolvedValue({
      digestFrequency: "off",
      digestDay: 1,
      lastDigestSentAt: null,
    } as never);
    vi.mocked(api.account.updateDigestPreferences).mockResolvedValue({
      digestFrequency: "weekly",
      digestDay: 1,
      lastDigestSentAt: null,
    } as never);

    render(<ScanResultsPage />);

    const createWorkspace = await screen.findByRole("button", {
      name: "Create Project Workspace",
    });
    fireEvent.click(createWorkspace);

    await waitFor(() => {
      expect(api.projects.create).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: "example.com",
        }),
      );
    });

    expect(api.projects.update).toHaveBeenCalledWith("proj-1", {
      settings: { schedule: "weekly" },
    });
    expect(api.pipeline.updateSettings).toHaveBeenCalledWith("proj-1", {
      autoRunOnCrawl: true,
    });
    expect(api.visibility.schedules.create).toHaveBeenCalledWith({
      projectId: "proj-1",
      query: "Example reviews",
      providers: ["chatgpt", "claude", "perplexity", "gemini"],
      frequency: "weekly",
    });
    expect(api.account.updateDigestPreferences).toHaveBeenCalledWith({
      digestFrequency: "weekly",
      digestDay: 1,
    });
    expect(pushMock).toHaveBeenCalledWith(
      "/dashboard/projects/proj-1?tab=overview&source=scan",
    );
  });
});
