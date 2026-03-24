import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
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

    fireEvent.click(screen.getByRole("button", { name: /New Report/i }));
    expect(onOpenGenerate).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(screen.getByRole("button", { name: /Export Data/i }));
    fireEvent.click(await screen.findByText("Export as CSV"));
    expect(onExport).toHaveBeenCalledWith("csv");
  });

  it("allows opening generate modal without a crawlJobId", () => {
    const onOpenGenerate = vi.fn();

    render(
      <ReportsTabToolbar onExport={vi.fn()} onOpenGenerate={onOpenGenerate} />,
    );

    const btn = screen.getByRole("button", { name: /New Report/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onOpenGenerate).toHaveBeenCalledTimes(1);
  });
});
