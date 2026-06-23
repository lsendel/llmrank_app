import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GenerateReportModal } from "./generate-report-modal";

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  api: {
    reports: {
      generate: vi.fn(),
    },
  },
}));

describe("GenerateReportModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the same audience presets for on-demand generation and scheduling", async () => {
    render(
      <GenerateReportModal
        open
        onClose={vi.fn()}
        projectId="proj-1"
        crawlJobId="crawl-1"
        onGenerated={vi.fn()}
        onCreateSchedule={vi.fn()}
      />,
    );

    expect(screen.getByText("Executive Summary")).toBeInTheDocument();
    expect(screen.getByText("SEO Lead")).toBeInTheDocument();
    expect(screen.getByText("Content Lead")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Content Lead"));

    expect(screen.getByText("Word Document (.docx)")).toBeInTheDocument();
    expect(
      screen.getByText("Detailed Technical Report (10-50+ pages)"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Schedule" }));

    expect(screen.getByText("Executive Summary")).toBeInTheDocument();
    expect(screen.getByText("SEO Lead")).toBeInTheDocument();
    expect(screen.getByText("Content Lead")).toBeInTheDocument();
  });
});
