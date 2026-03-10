import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScoringProfileCard } from "./scoring-profile-section-sections";

describe("scoring profile section sections", () => {
  it("renders the collapsed preset summary", () => {
    render(
      <ScoringProfileCard
        weights={{
          technical: 25,
          content: 30,
          aiReadiness: 30,
          performance: 15,
        }}
        preset="default"
        showCustomEditor={false}
        saving={false}
        total={100}
        isValid={true}
        onPresetChange={vi.fn()}
        onToggleCustomEditor={vi.fn()}
        onWeightChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const toggle = screen.getByRole("button", {
      name: /Advanced weight editor/i,
    });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/Using preset:/i)).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="range"]')).toHaveLength(0);
  });

  it("forwards preset, editor, weight, and save actions", () => {
    const onPresetChange = vi.fn();
    const onToggleCustomEditor = vi.fn();
    const onWeightChange = vi.fn();
    const onSave = vi.fn();

    const { container } = render(
      <ScoringProfileCard
        weights={{
          technical: 20,
          content: 25,
          aiReadiness: 30,
          performance: 15,
        }}
        preset="custom"
        showCustomEditor={true}
        saving={false}
        total={90}
        isValid={false}
        onPresetChange={onPresetChange}
        onToggleCustomEditor={onToggleCustomEditor}
        onWeightChange={onWeightChange}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "SaaS" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Advanced weight editor/i,
      }),
    );

    const sliders = container.querySelectorAll('input[type="range"]');
    fireEvent.change(sliders[0]!, { target: { value: "35" } });

    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.getByText(/must equal 100%/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Profile" })).toBeDisabled();
    expect(onPresetChange).toHaveBeenCalledWith("saas");
    expect(onToggleCustomEditor).toHaveBeenCalledTimes(1);
    expect(onWeightChange).toHaveBeenCalledWith("technical", 35);
    expect(onSave).not.toHaveBeenCalled();
  });
});
