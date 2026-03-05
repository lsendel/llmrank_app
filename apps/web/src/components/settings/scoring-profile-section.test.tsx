import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScoringProfileSection } from "./scoring-profile-section";

const mockUseApiSWR = vi.fn();
const mockToast = vi.fn();

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => mockUseApiSWR(...args),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    scoringProfiles: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("ScoringProfileSection advanced editor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApiSWR.mockReturnValue({
      data: [],
      mutate: vi.fn(),
    });
  });

  it("starts with advanced editor collapsed", () => {
    render(<ScoringProfileSection projectId="proj-1" />);

    const toggle = screen.getByRole("button", {
      name: /Advanced weight editor/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelectorAll('input[type="range"]')).toHaveLength(0);
  });

  it("shows sliders when advanced editor is expanded", () => {
    render(<ScoringProfileSection projectId="proj-1" />);

    const toggle = screen.getByRole("button", {
      name: /Advanced weight editor/i,
    });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.querySelectorAll('input[type="range"]')).toHaveLength(4);
  });
});
