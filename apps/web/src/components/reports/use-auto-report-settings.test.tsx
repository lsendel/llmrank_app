import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useAutoReportSettings } from "./use-auto-report-settings";

const toastMock = vi.fn();

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

describe("useAutoReportSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.reports.schedules.list = vi.fn(async () => []);
    api.reports.schedules.create = vi.fn(async (input) => ({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      format: input.format,
      type: input.type,
      recipientEmail: input.recipientEmail,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    api.reports.schedules.update = vi.fn(async (id, input) => ({
      id,
      projectId: "proj-1",
      format: "pdf",
      type: "summary",
      recipientEmail: "client@example.com",
      enabled: input.enabled ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    api.reports.schedules.delete = vi.fn(async () => undefined);
    api.reports.generate = vi.fn(async () => ({
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
    }));
  });

  it("creates schedules for multiple recipients using the selected preset", async () => {
    const { result } = renderHook(() =>
      useAutoReportSettings({ projectId: "proj-1", crawlJobId: "crawl-1" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleAudienceSelect("content_lead");
      result.current.setRecipientInput("team@example.com; owner@example.com");
    });

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(api.reports.schedules.create).toHaveBeenCalledTimes(2);
    expect(api.reports.schedules.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        projectId: "proj-1",
        format: "docx",
        type: "detailed",
        recipientEmail: "team@example.com",
      }),
    );
    expect(api.reports.schedules.create).toHaveBeenNthCalledWith(
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
    const onReportGenerated = vi.fn();
    const schedule = {
      id: "sched-1",
      projectId: "proj-1",
      format: "pdf",
      type: "summary",
      recipientEmail: "client@example.com",
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    api.reports.schedules.list = vi.fn(async () => [schedule]);

    const { result } = renderHook(() =>
      useAutoReportSettings({
        projectId: "proj-1",
        crawlJobId: "crawl-1",
        onReportGenerated,
      }),
    );

    await waitFor(() => expect(result.current.schedules).toHaveLength(1));

    await act(async () => {
      await result.current.handleSendNow(schedule);
    });

    expect(api.reports.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-1",
        crawlJobId: "crawl-1",
        format: "pdf",
        type: "summary",
        config: { preparedFor: "client@example.com" },
      }),
    );
    expect(onReportGenerated).toHaveBeenCalledTimes(1);
  });
});
