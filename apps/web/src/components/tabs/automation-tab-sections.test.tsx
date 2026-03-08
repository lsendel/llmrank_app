import { fireEvent, render, screen } from "@testing-library/react";
import type { PipelineRun } from "@/lib/api";
import {
  AutomationFailedStepsSection,
  AutomationHealthSection,
  AutomationRecentRunsSection,
  AutomationSettingsSection,
  AutomationStatusSection,
} from "./automation-tab-sections";
import { vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

describe("automation-tab sections", () => {
  it("renders status metrics, current step, and action callbacks", () => {
    const onRerun = vi.fn();
    const onHealthCheck = vi.fn();
    const onRetryAction = vi.fn();

    render(
      <AutomationStatusSection
        latestRun={{
          id: "run-1",
          status: "failed",
          currentStep: "keywords",
          stepResults: null,
          startedAt: null,
          completedAt: null,
          createdAt: "2024-01-01T00:00:00.000Z",
        }}
        totalRuns={12}
        successRate={75}
        failedRuns={3}
        isRerunning={false}
        healthLoading={false}
        actionError="Last run failed"
        retryDisabled={false}
        onRerun={onRerun}
        onHealthCheck={onHealthCheck}
        onRetryAction={onRetryAction}
      />,
    );

    expect(screen.getByText("Automation Status")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText(/Current step:/)).toBeInTheDocument();
    expect(screen.getByText("Last run failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Run Pipeline Now" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Health Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry action" }));

    expect(onRerun).toHaveBeenCalledTimes(1);
    expect(onHealthCheck).toHaveBeenCalledTimes(1);
    expect(onRetryAction).toHaveBeenCalledTimes(1);
  });

  it("renders settings controls, hidden skip rule notice, and save/reset actions", () => {
    const onAutoRunChange = vi.fn();
    const onToggleSkipStep = vi.fn();
    const onReset = vi.fn();
    const onSave = vi.fn();

    render(
      <AutomationSettingsSection
        settingsReady
        autoRunOnCrawl
        settingsControlsDisabled={false}
        skipSteps={["personas"]}
        savedUnknownSkipSteps={["custom_step"]}
        settingsError="Save failed"
        settingsSaving={false}
        settingsDirty
        onAutoRunChange={onAutoRunChange}
        onToggleSkipStep={onToggleSkipStep}
        onReset={onReset}
        onSave={onSave}
      />,
    );

    expect(screen.getByText("Pipeline Settings")).toBeInTheDocument();
    expect(
      screen.getByText(/Additional hidden skip rules will be preserved/),
    ).toBeInTheDocument();
    expect(screen.getByText("Save failed")).toBeInTheDocument();

    fireEvent.click(
      screen.getByLabelText(
        "Run pipeline automatically after crawl completion",
      ),
    );
    fireEvent.click(screen.getByLabelText("Personas"));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));

    expect(onAutoRunChange).toHaveBeenCalledWith(false);
    expect(onToggleSkipStep).toHaveBeenCalledWith("personas");
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("renders failed steps with remediation links", () => {
    render(
      <AutomationFailedStepsSection
        projectId="proj-1"
        failedSteps={[{ step: "visibility_check", error: "Provider timeout" }]}
      />,
    );

    expect(screen.getByText("Latest Failed Steps")).toBeInTheDocument();
    expect(screen.getByText("Provider timeout")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Visibility Workspace" }),
    ).toHaveAttribute("href", "/dashboard/projects/proj-1?tab=visibility");
  });

  it("renders health check results and suggestions", () => {
    render(
      <AutomationHealthSection
        healthResult={{
          projectId: "proj-1",
          crawlJobId: "crawl-1",
          score: 82,
          checks: [
            {
              check: "crawler",
              category: "technical",
              status: "pass",
              message: "Crawler is configured",
              autoFixable: false,
            },
            {
              check: "billing",
              category: "billing",
              status: "warn",
              message: "Upgrade recommended",
              autoFixable: false,
              suggestion: "Consider enabling a paid tier",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Health Check Score: 82")).toBeInTheDocument();
    expect(screen.getByText("Crawler is configured")).toBeInTheDocument();
    expect(screen.getByText("Upgrade recommended")).toBeInTheDocument();
    expect(
      screen.getByText(/Consider enabling a paid tier/),
    ).toBeInTheDocument();
  });

  it("renders empty and populated recent run states", () => {
    const { rerender } = render(<AutomationRecentRunsSection runs={[]} />);

    expect(screen.getByText(/No pipeline runs yet/)).toBeInTheDocument();

    rerender(
      <AutomationRecentRunsSection
        runs={[
          {
            id: "run-abcdef12",
            status: "completed",
            currentStep: null,
            stepResults: {},
            startedAt: null,
            completedAt: null,
            createdAt: "2024-01-01T00:00:00.000Z",
          } as PipelineRun,
        ]}
      />,
    );

    expect(screen.getByText("run-abcd")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
  });
});
