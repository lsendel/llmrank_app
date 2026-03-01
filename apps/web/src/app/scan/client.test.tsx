import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ScanPageClient } from "@/app/scan/client";
import { api, ApiError } from "@/lib/api";
import { track } from "@/lib/telemetry";
import { vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/api", () => {
  class MockApiError extends Error {}
  return {
    api: {
      public: {
        scan: vi.fn(),
      },
    },
    ApiError: MockApiError,
  };
});

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

describe("ScanPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tracks pre-scan conversion CTA clicks", () => {
    render(<ScanPageClient />);

    fireEvent.click(
      screen.getByRole("link", { name: "Create Project Workspace" }),
    );
    fireEvent.click(screen.getByRole("link", { name: "Connect Integrations" }));
    fireEvent.click(
      screen.getByRole("link", { name: "Schedule Recurring Scans" }),
    );

    expect(track).toHaveBeenCalledWith(
      "scan_entry_cta_clicked",
      expect.objectContaining({
        cta: "create_project",
        destination: "/sign-up",
        placement: "scan_preflight",
      }),
    );
    expect(track).toHaveBeenCalledWith(
      "scan_entry_cta_clicked",
      expect.objectContaining({
        cta: "connect_integration",
        destination: "/integrations",
        placement: "scan_preflight",
      }),
    );
    expect(track).toHaveBeenCalledWith(
      "scan_entry_cta_clicked",
      expect.objectContaining({
        cta: "schedule_recurring_scan",
        destination: "/pricing",
        placement: "scan_preflight",
      }),
    );
  });

  it("tracks scan start and navigates to results on success", async () => {
    vi.mocked(api.public.scan).mockResolvedValue({
      scanResultId: "scan-123",
    } as never);

    render(<ScanPageClient />);

    fireEvent.change(screen.getByPlaceholderText("example.com"), {
      target: { value: "example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Scan" }));

    await waitFor(() => {
      expect(api.public.scan).toHaveBeenCalledWith("example.com");
    });

    expect(track).toHaveBeenCalledWith("scan.started", {
      domain: "example.com",
    });
    expect(pushMock).toHaveBeenCalledWith(
      "/scan/results?id=scan-123&source=scan",
    );
  });

  it("tracks scan failure with API reason", async () => {
    vi.mocked(api.public.scan).mockRejectedValue(new ApiError("scan down"));

    render(<ScanPageClient />);

    fireEvent.change(screen.getByPlaceholderText("example.com"), {
      target: { value: "example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Scan" }));

    await waitFor(() => {
      expect(track).toHaveBeenCalledWith(
        "scan.failed",
        expect.objectContaining({
          domain: "example.com",
          reason: "scan down",
        }),
      );
    });

    expect(await screen.findByText("scan down")).toBeInTheDocument();
  });
});
