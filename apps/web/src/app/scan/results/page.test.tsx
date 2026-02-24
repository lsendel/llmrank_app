import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ScanResultsPage from "@/app/scan/results/page";
import { api } from "@/lib/api";
import { track } from "@/lib/telemetry";
import { vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === "id" ? "scan-1" : null),
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    public: {
      getScanResult: vi.fn(),
    },
  },
}));

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

describe("Scan Results conversion actions", () => {
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
});
