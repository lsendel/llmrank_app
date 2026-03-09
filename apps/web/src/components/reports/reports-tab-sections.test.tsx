import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AutoReportSettingsSection,
  ReportsTabLoadingState,
  ReportsTabToolbar,
} from "./reports-tab-sections";

describe("reports-tab sections", () => {
  it("renders the loading state", () => {
    const { container } = render(<ReportsTabLoadingState />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("forwards toolbar actions", async () => {
    const onExport = vi.fn();
    const onOpenGenerate = vi.fn();

    render(
      <ReportsTabToolbar
        crawlJobId="crawl-1"
        onExport={onExport}
        onOpenGenerate={onOpenGenerate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Generate Report/i }));
    expect(onOpenGenerate).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(screen.getByRole("button", { name: /Export Data/i }));
    fireEvent.click(await screen.findByText("Export as CSV"));
    expect(onExport).toHaveBeenCalledWith("csv");
  });

  it("renders schedule rows and preset selection controls", () => {
    const onAudienceSelect = vi.fn();

    render(
      <AutoReportSettingsSection
        crawlJobId="crawl-1"
        schedules={[
          {
            id: "sched-1",
            projectId: "proj-1",
            format: "pdf",
            type: "summary",
            recipientEmail: "client@example.com",
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
        locked={false}
        audience="executive"
        recipientInput="client@example.com"
        format="pdf"
        type="summary"
        saving={false}
        sendingNowScheduleId={null}
        selectedPreset={{
          label: "Executive Summary",
          description: "High-level outcomes for leadership updates.",
          format: "pdf",
          type: "summary",
        }}
        onAudienceSelect={onAudienceSelect}
        onRecipientInputChange={vi.fn()}
        onFormatChange={vi.fn()}
        onTypeChange={vi.fn()}
        onCreate={vi.fn()}
        onSendNow={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Auto-Report Settings")).toBeInTheDocument();
    expect(screen.getByText("client@example.com")).toBeInTheDocument();
    expect(
      screen.getByText(/Audience: Executive Summary/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /SEO Lead/i }));
    expect(onAudienceSelect).toHaveBeenCalledWith("seo_lead");
  });
});
