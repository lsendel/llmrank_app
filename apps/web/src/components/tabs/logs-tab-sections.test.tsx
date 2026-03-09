import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  LogsTabHeader,
  LogsTabHistorySection,
  LogsTabSummarySection,
  LogsTabUploadSection,
} from "./logs-tab-sections";

describe("logs-tab sections", () => {
  it("renders the tab header", () => {
    render(<LogsTabHeader />);
    expect(screen.getByText("Server Log Analysis")).toBeInTheDocument();
  });

  it("forwards upload section actions", () => {
    const onBrowse = vi.fn();
    const onRetry = vi.fn();
    const onDismiss = vi.fn();

    render(
      <LogsTabUploadSection
        fileInputRef={createRef<HTMLInputElement>()}
        uploading={false}
        error="Bad log file"
        canRetryUpload
        onBrowse={onBrowse}
        onFileChange={vi.fn()}
        onDrop={vi.fn()}
        onRetry={onRetry}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByText(/Drop a log file here/i));
    fireEvent.click(screen.getByRole("button", { name: /Retry upload/i }));
    fireEvent.click(screen.getByRole("button", { name: /Dismiss/i }));

    expect(onBrowse).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders summary cards and upload history states", () => {
    render(
      <>
        <LogsTabSummarySection
          summary={{
            totalRequests: 100,
            crawlerRequests: 25,
            uniqueIPs: 10,
            botBreakdown: [{ bot: "ClaudeBot (Anthropic)", count: 12 }],
            statusBreakdown: [],
            topPaths: [{ path: "/pricing", count: 8 }],
          }}
        />
        <LogsTabHistorySection
          isLoading={false}
          uploads={[
            {
              id: "upload-1",
              projectId: "proj-1",
              filename: "access.log",
              totalRequests: 100,
              crawlerRequests: 25,
              uniqueIPs: 10,
              summary: {
                totalRequests: 100,
                crawlerRequests: 25,
                uniqueIPs: 10,
                botBreakdown: [],
                statusBreakdown: [],
                topPaths: [],
              },
              createdAt: new Date("2024-01-01T00:00:00.000Z").toISOString(),
            },
          ]}
        />
      </>,
    );

    expect(screen.getByText("25.0%")).toBeInTheDocument();
    expect(screen.getByText("Bot Breakdown")).toBeInTheDocument();
    expect(screen.getByText("/pricing")).toBeInTheDocument();
    expect(screen.getByText("Upload History")).toBeInTheDocument();
    expect(screen.getByText("access.log")).toBeInTheDocument();
  });
});
