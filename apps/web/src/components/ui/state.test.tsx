import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StateMessage } from "./state";

describe("StateMessage", () => {
  it("renders a default retry action when retry is provided", () => {
    const onRetry = vi.fn();

    render(
      <StateMessage
        variant="error"
        title="Something failed"
        description="Please try again."
        retry={{ onClick: onRetry }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("prefers explicit action content over retry prop", () => {
    const onRetry = vi.fn();

    render(
      <StateMessage
        variant="error"
        retry={{ onClick: onRetry }}
        action={<button type="button">Custom Action</button>}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Custom Action" }),
    ).toBeInTheDocument();
  });
});
