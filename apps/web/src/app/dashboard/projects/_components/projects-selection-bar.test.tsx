import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectsSelectionBar } from "./projects-selection-bar";

describe("ProjectsSelectionBar", () => {
  it("shows anomaly-specific bulk actions when the selection is actionable", () => {
    render(
      <ProjectsSelectionBar
        selectedCount={3}
        anomalyFilter="pipeline_disabled"
        bulkEnablingPipeline={false}
        selectedPipelineDisabledCount={2}
        onEnablePipelineDefaults={vi.fn()}
        bulkPlanningSmartFixes={false}
        onPlanSmartFixes={vi.fn()}
        bulkCrawling={false}
        onRunCrawl={vi.fn()}
        bulkDeleting={false}
        onDelete={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );

    expect(screen.getByText("3 selected")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Enable Pipeline Defaults/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Plan Smart Fixes/i }),
    ).toBeInTheDocument();
  });

  it("hides anomaly-only actions for the default all view", () => {
    const clearSelection = vi.fn();

    render(
      <ProjectsSelectionBar
        selectedCount={1}
        anomalyFilter="all"
        bulkEnablingPipeline={false}
        selectedPipelineDisabledCount={0}
        onEnablePipelineDefaults={vi.fn()}
        bulkPlanningSmartFixes={false}
        onPlanSmartFixes={vi.fn()}
        bulkCrawling={false}
        onRunCrawl={vi.fn()}
        bulkDeleting={false}
        onDelete={vi.fn()}
        onClearSelection={clearSelection}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Enable Pipeline Defaults/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Plan Smart Fixes/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Clear Selection/i }));
    expect(clearSelection).toHaveBeenCalledTimes(1);
  });
});
