import { fireEvent, render, screen } from "@testing-library/react";
import type { IntegrationInsights, ProjectIntegration } from "@/lib/api";
import {
  IntegrationAnalyticsSection,
  IntegrationCardsSection,
  IntegrationConnectDialog,
  IntegrationStatusSection,
} from "./integrations-tab-sections";
import { vi } from "vitest";

vi.mock("@/components/integration-insights-view", () => ({
  IntegrationInsightsView: ({
    connectedProviders,
  }: {
    connectedProviders: string[];
  }) => <div>Insights View ({connectedProviders.join(",")})</div>,
}));

describe("integrations-tab sections", () => {
  it("renders success and error status banners and retries sync", () => {
    const onRetrySync = vi.fn();

    render(
      <IntegrationStatusSection
        connectedProvider="gsc"
        error="Sync failed"
        onRetrySync={onRetrySync}
      />,
    );

    expect(
      screen.getByText("Google Search Console connected successfully."),
    ).toBeInTheDocument();
    expect(screen.getByText("Integration action failed")).toBeInTheDocument();
    expect(screen.getByText("Sync failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry Sync" }));

    expect(onRetrySync).toHaveBeenCalledTimes(1);
  });

  it("renders locked integration cards and the single available connect action", () => {
    render(
      <IntegrationCardsSection
        currentPlan="starter"
        integrations={[]}
        testing={null}
        disconnecting={null}
        testResult={null}
        onToggleIntegration={() => {}}
        onTestIntegration={() => {}}
        onDisconnectIntegration={() => {}}
        onConnectOauth={() => {}}
        onOpenConnectModal={() => {}}
      />,
    );

    expect(screen.getAllByText("Pro+")).toHaveLength(2);
    expect(screen.getAllByText("Agency+")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Connect" })).toHaveLength(1);
  });

  it("renders connected integration actions and test feedback", () => {
    render(
      <IntegrationCardsSection
        currentPlan="agency"
        integrations={[
          {
            id: "gsc-1",
            provider: "gsc",
            hasCredentials: true,
            enabled: true,
            lastSyncAt: "2024-01-01T00:00:00.000Z",
            lastError: null,
          } as ProjectIntegration,
        ]}
        testing={null}
        disconnecting={null}
        testResult={{ id: "gsc-1", ok: true, message: "Connection healthy" }}
        onToggleIntegration={() => {}}
        onTestIntegration={() => {}}
        onDisconnectIntegration={() => {}}
        onConnectOauth={() => {}}
        onOpenConnectModal={() => {}}
      />,
    );

    expect(screen.getByText(/Last synced:/)).toBeInTheDocument();
    expect(screen.getByText("Test Connection")).toBeInTheDocument();
    expect(screen.getByText("Disconnect")).toBeInTheDocument();
    expect(screen.getByText("Connection healthy")).toBeInTheDocument();
  });

  it("renders the integration loading state", () => {
    render(
      <IntegrationAnalyticsSection
        integrationInsights={undefined}
        previousCrawlId={null}
        previousInsights={undefined}
        integrations={[]}
        integrationDeltaMetrics={[]}
        hasConnectedIntegrations={false}
        syncing={false}
        onSync={() => {}}
        signalTaskPlan={{ reasons: [], items: [] }}
        autoPlanningSignals={false}
        onAutoPlanSignalTasks={() => {}}
      />,
    );

    expect(
      screen.getByText("Loading integration insights"),
    ).toBeInTheDocument();
  });

  it("renders delta metrics, task shortcuts, and report enhancement cards", () => {
    render(
      <IntegrationAnalyticsSection
        integrationInsights={
          {
            crawlId: "crawl-2",
            integrations: {},
          } as IntegrationInsights
        }
        previousCrawlId="crawl-1"
        previousInsights={
          { crawlId: "crawl-1", integrations: {} } as IntegrationInsights
        }
        integrations={[
          {
            id: "gsc-1",
            provider: "gsc",
            hasCredentials: true,
            enabled: true,
          } as ProjectIntegration,
        ]}
        integrationDeltaMetrics={[
          {
            id: "gsc-clicks",
            label: "GSC Clicks",
            currentValue: "120",
            deltaValue: "+20",
            direction: "positive",
          },
        ]}
        hasConnectedIntegrations
        syncing={false}
        onSync={() => {}}
        signalTaskPlan={{
          reasons: ["3 pages are not indexed in Google."],
          items: [
            {
              issueCode: "ISSUE_1",
              status: "pending",
              severity: "warning",
              category: "technical",
              scoreImpact: 6,
              title: "Fix issue 1",
              description: "Description 1",
            },
            {
              issueCode: "ISSUE_2",
              status: "pending",
              severity: "warning",
              category: "technical",
              scoreImpact: 6,
              title: "Fix issue 2",
              description: "Description 2",
            },
          ],
        }}
        autoPlanningSignals={false}
        onAutoPlanSignalTasks={() => {}}
      />,
    );

    expect(screen.getByText("Insights View (gsc)")).toBeInTheDocument();
    expect(screen.getByText("GSC Clicks")).toBeInTheDocument();
    expect(screen.getByText(/\+20 vs previous/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create up to 2 tasks" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/3 pages are not indexed in Google/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("How integrations enhance your reports"),
    ).toBeInTheDocument();
  });

  it("renders the PSI connect dialog with API key guidance", () => {
    render(
      <IntegrationConnectDialog
        connectModal={{ provider: "psi", label: "PageSpeed Insights" }}
        apiKeyInput=""
        clarityProjectId=""
        metaAdAccountId=""
        connecting={false}
        error={null}
        onApiKeyInputChange={() => {}}
        onClarityProjectIdChange={() => {}}
        onMetaAdAccountIdChange={() => {}}
        onClose={() => {}}
        onConnect={() => {}}
        onMetaConnect={() => {}}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Connect PageSpeed Insights" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("API Key")).toBeInTheDocument();
    expect(screen.getByText("Get your API key")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
  });

  it("renders the Meta dialog and routes cancel/sign-in actions", () => {
    const onClose = vi.fn();
    const onMetaConnect = vi.fn();

    render(
      <IntegrationConnectDialog
        connectModal={{ provider: "meta", label: "Meta Ads" }}
        apiKeyInput=""
        clarityProjectId=""
        metaAdAccountId="act_123"
        connecting={false}
        error="Meta auth failed"
        onApiKeyInputChange={() => {}}
        onClarityProjectIdChange={() => {}}
        onMetaAdAccountIdChange={() => {}}
        onClose={onClose}
        onConnect={() => {}}
        onMetaConnect={onMetaConnect}
      />,
    );

    expect(screen.queryByLabelText("API Key")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Ad Account ID/)).toBeInTheDocument();
    expect(screen.getByText("Meta auth failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with Facebook" }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMetaConnect).toHaveBeenCalledTimes(1);
  });
});
