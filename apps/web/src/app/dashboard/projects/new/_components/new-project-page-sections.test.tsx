import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewProjectPageLayout } from "./new-project-page-sections";

vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("new project page sections", () => {
  it("renders the extracted project setup layout", () => {
    render(
      <NewProjectPageLayout
        name="Marketing Site"
        domain="example.com"
        autoStartCrawl
        crawlSchedule="weekly"
        enableAutomationPipeline
        enableVisibilitySchedule
        enableWeeklyDigest={false}
        errors={{}}
        submitting={false}
        submitLabel="Create Project"
        onNameChange={vi.fn()}
        onDomainChange={vi.fn()}
        onDomainBlur={vi.fn()}
        onAutoStartCrawlChange={vi.fn()}
        onCrawlScheduleChange={vi.fn()}
        onEnableAutomationPipelineChange={vi.fn()}
        onEnableVisibilityScheduleChange={vi.fn()}
        onEnableWeeklyDigestChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Project setup workflow")).toBeInTheDocument();
    expect(screen.getByText("New Project")).toBeInTheDocument();
    expect(
      screen.getByText(/Configure launch defaults now/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Enter the root domain to audit/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Project" }),
    ).toBeEnabled();
  });

  it("shows validation errors and forwards cancel actions", () => {
    const onCancel = vi.fn();

    render(
      <NewProjectPageLayout
        name=""
        domain=""
        autoStartCrawl={false}
        crawlSchedule="manual"
        enableAutomationPipeline={false}
        enableVisibilitySchedule={false}
        enableWeeklyDigest
        errors={{
          form: "Upgrade required",
          name: "Name is required and must be 100 characters or fewer.",
          domain: "Domain is required.",
        }}
        submitting
        submitLabel="Creating..."
        onNameChange={vi.fn()}
        onDomainChange={vi.fn()}
        onDomainBlur={vi.fn()}
        onAutoStartCrawlChange={vi.fn()}
        onCrawlScheduleChange={vi.fn()}
        onEnableAutomationPipelineChange={vi.fn()}
        onEnableVisibilityScheduleChange={vi.fn()}
        onEnableWeeklyDigestChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText("Upgrade required")).toBeInTheDocument();
    expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
    expect(screen.getByText("Domain is required.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
