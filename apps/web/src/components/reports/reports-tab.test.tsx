import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ReportsTab from "./reports-tab";
import type { Report, ReportSchedule } from "@/lib/api";

const toastMock = vi.fn();
const listReportsMock = vi.fn<() => Promise<Report[]>>();
const listSchedulesMock = vi.fn<() => Promise<ReportSchedule[]>>();
const createScheduleMock = vi.fn();
const generateReportMock = vi.fn();

// Capture props passed to mocked components
let capturedReportListProps: Record<string, unknown> = {};
let capturedModalProps: Record<string, unknown> = {};

vi.mock("@/components/reports/report-list", () => ({
  ReportList: (props: Record<string, unknown>) => {
    capturedReportListProps = props;
    return <div data-testid="report-list">Report List</div>;
  },
}));

vi.mock("@/components/reports/generate-report-modal", () => ({
  GenerateReportModal: (props: Record<string, unknown>) => {
    capturedModalProps = props;
    return null;
  },
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
    capturedReportListProps = {};
    capturedModalProps = {};
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

  it("passes schedules to ReportList and schedule handlers to GenerateReportModal", async () => {
    const schedules: ReportSchedule[] = [
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
    ];
    listSchedulesMock.mockResolvedValue(schedules);

    render(<ReportsTab projectId="proj-1" crawlJobId="crawl-1" />);

    await screen.findByTestId("report-list");

    await waitFor(() => {
      expect(capturedReportListProps.schedules).toEqual(schedules);
      expect(capturedReportListProps.crawlJobId).toBe("crawl-1");
      expect(typeof capturedReportListProps.onScheduleSendNow).toBe("function");
      expect(typeof capturedReportListProps.onScheduleToggle).toBe("function");
      expect(typeof capturedReportListProps.onScheduleDelete).toBe("function");
    });
  });

  it("passes onCreateSchedule and locked to GenerateReportModal", async () => {
    render(<ReportsTab projectId="proj-1" crawlJobId="crawl-1" />);

    await screen.findByTestId("report-list");

    await waitFor(() => {
      expect(typeof capturedModalProps.onCreateSchedule).toBe("function");
      expect(capturedModalProps.locked).toBeDefined();
      expect(capturedModalProps.scheduleSaving).toBeDefined();
    });
  });

  it("renders GenerateReportModal even without crawlJobId", async () => {
    render(<ReportsTab projectId="proj-1" crawlJobId={undefined} />);

    await screen.findByTestId("report-list");

    await waitFor(() => {
      expect(capturedModalProps.crawlJobId).toBeUndefined();
      expect(capturedModalProps.projectId).toBe("proj-1");
    });
  });
});
