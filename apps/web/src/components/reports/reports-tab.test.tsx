import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ReportsTab from "./reports-tab";
import type { Report, ReportSchedule } from "@/lib/api";

const toastMock = vi.fn();
const listReportsMock = vi.fn<() => Promise<Report[]>>();
const listSchedulesMock = vi.fn<() => Promise<ReportSchedule[]>>();
const createScheduleMock = vi.fn();
const generateReportMock = vi.fn();

vi.mock("@/components/reports/report-list", () => ({
  ReportList: () => <div data-testid="report-list">Report List</div>,
}));

vi.mock("@/components/reports/generate-report-modal", () => ({
  GenerateReportModal: () => null,
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

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
    crawls: {
      exportData: vi.fn(),
    },
    reports: {
      list: (...args: unknown[]) => listReportsMock(...args),
      delete: vi.fn(),
      generate: (...args: unknown[]) => generateReportMock(...args),
      schedules: {
        list: (...args: unknown[]) => listSchedulesMock(...args),
        create: (...args: unknown[]) => createScheduleMock(...args),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  },
}));

describe("ReportsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listReportsMock.mockResolvedValue([]);
    listSchedulesMock.mockResolvedValue([]);
    createScheduleMock.mockImplementation(async (input) => ({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      format: input.format,
      type: input.type,
      recipientEmail: input.recipientEmail,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    generateReportMock.mockResolvedValue({
      id: "report-1",
      projectId: "proj-1",
      crawlJobId: "crawl-1",
      type: "summary",
      format: "pdf",
      status: "queued",
      r2Key: null,
      fileSize: null,
      config: {},
      error: null,
      generatedAt: null,
      expiresAt: null,
      createdAt: new Date().toISOString(),
    });
  });

  it("creates schedules for multiple recipients using the selected preset", async () => {
    render(<ReportsTab projectId="proj-1" crawlJobId="crawl-1" />);

    await screen.findByText("Auto-Report Settings");

    fireEvent.click(screen.getByRole("button", { name: /Content Lead/i }));
    fireEvent.change(screen.getByLabelText("Recipient Email"), {
      target: { value: "team@example.com; owner@example.com" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "3. Add Schedule" }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "3. Add Schedule" }));

    await waitFor(() => expect(createScheduleMock).toHaveBeenCalledTimes(2));

    expect(createScheduleMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        projectId: "proj-1",
        format: "docx",
        type: "detailed",
        recipientEmail: "team@example.com",
      }),
    );
    expect(createScheduleMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        projectId: "proj-1",
        format: "docx",
        type: "detailed",
        recipientEmail: "owner@example.com",
      }),
    );
  });

  it("queues a report immediately from an existing schedule", async () => {
    listSchedulesMock.mockResolvedValue([
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
    ]);

    render(<ReportsTab projectId="proj-1" crawlJobId="crawl-1" />);
    await screen.findByText("client@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Send now" }));

    await waitFor(() =>
      expect(generateReportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "proj-1",
          crawlJobId: "crawl-1",
          format: "pdf",
          type: "summary",
          config: { preparedFor: "client@example.com" },
        }),
      ),
    );
  });
});
