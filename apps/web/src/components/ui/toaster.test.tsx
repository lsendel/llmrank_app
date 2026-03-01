import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "./toaster";
import { clearToasts, useToast } from "./use-toast";

describe("Toaster", () => {
  beforeEach(() => {
    act(() => {
      clearToasts();
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      clearToasts();
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  it("renders warning variant with status role and amber styling", () => {
    render(<Toaster />);

    act(() => {
      useToast().toast({
        title: "Heads up",
        description: "Review this setting.",
        variant: "warning",
      });
    });

    const toast = screen.getByText("Heads up").closest('[role="status"]');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveClass("border-amber-500/50");
    expect(screen.getByText("Review this setting.")).toHaveClass(
      "text-amber-800",
    );
  });

  it("renders info variant with sky styling", () => {
    render(<Toaster />);

    act(() => {
      useToast().toast({
        title: "Sync complete",
        description: "No action required.",
        variant: "info",
      });
    });

    const toast = screen.getByText("Sync complete").closest('[role="status"]');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveClass("border-sky-500/50");
    expect(screen.getByText("No action required.")).toHaveClass("text-sky-800");
  });

  it("dismisses a toast when clicking dismiss control", () => {
    render(<Toaster />);

    act(() => {
      useToast().toast({
        title: "Closable",
      });
    });

    expect(screen.getByText("Closable")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Dismiss notification"));
    expect(screen.queryByText("Closable")).not.toBeInTheDocument();
  });

  it("auto-dismisses toasts after timeout", () => {
    render(<Toaster />);

    act(() => {
      useToast().toast({
        title: "Temporary toast",
      });
    });

    expect(screen.getByText("Temporary toast")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText("Temporary toast")).not.toBeInTheDocument();
  });
});
