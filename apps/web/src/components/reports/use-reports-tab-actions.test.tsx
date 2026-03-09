import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useReportsTabActions } from "./use-reports-tab-actions";

const toastMock = vi.fn();

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

describe("useReportsTabActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.crawls.exportData = vi.fn(async () => "csv-content");
    api.reports.delete = vi.fn(async () => undefined);
  });

  it("exports crawl data as csv", async () => {
    const createObjectUrl = vi.fn(() => "blob:url");
    const revokeObjectUrl = vi.fn();
    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);

    vi.stubGlobal("URL", {
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string) => {
        if (tagName === "a") {
          return { click } as HTMLAnchorElement;
        }
        return originalCreateElement(tagName);
      },
    );

    const { result } = renderHook(() => {
      const [reports, setReports] = useState([]);
      return {
        reports,
        ...useReportsTabActions({ crawlJobId: "crawl-1", setReports }),
      };
    });

    await act(async () => {
      await result.current.handleExport("csv");
    });

    expect(api.crawls.exportData).toHaveBeenCalledWith("crawl-1", "csv");
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:url");
  });

  it("deletes a report and removes it from local state", async () => {
    const { result } = renderHook(() => {
      const [reports, setReports] = useState([
        {
          id: "report-1",
          projectId: "proj-1",
          crawlJobId: "crawl-1",
          type: "summary",
          format: "pdf",
          status: "complete",
          r2Key: null,
          fileSize: null,
          config: {},
          error: null,
          generatedAt: null,
          expiresAt: null,
          createdAt: new Date().toISOString(),
        },
      ]);

      return {
        reports,
        ...useReportsTabActions({ crawlJobId: "crawl-1", setReports }),
      };
    });

    await act(async () => {
      await result.current.handleDelete("report-1");
    });

    expect(api.reports.delete).toHaveBeenCalledWith("report-1");
    expect(result.current.reports).toEqual([]);
  });
});
