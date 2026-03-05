import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteContextSection } from "./site-context-section";

const mockUseProject = vi.fn();
const mockToast = vi.fn();
const mockUpdateSiteContext = vi.fn();
const mockRediscoverCompetitors = vi.fn();

vi.mock("@/hooks/use-project", () => ({
  useProject: (...args: unknown[]) => mockUseProject(...args),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    projects: {
      updateSiteContext: (...args: unknown[]) => mockUpdateSiteContext(...args),
      rediscoverCompetitors: (...args: unknown[]) =>
        mockRediscoverCompetitors(...args),
    },
  },
}));

describe("SiteContextSection advanced actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProject.mockReturnValue({
      data: {
        siteDescription: "B2B SaaS platform",
        industry: "SaaS",
      },
      mutate: vi.fn(),
    });
    mockUpdateSiteContext.mockResolvedValue({});
    mockRediscoverCompetitors.mockResolvedValue({});
  });

  it("keeps advanced actions collapsed by default", () => {
    render(<SiteContextSection projectId="proj-1" />);

    const toggle = screen.getByRole("button", { name: /Advanced actions/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: /Re-discover Competitors/i }),
    ).not.toBeInTheDocument();
  });

  it("reveals rediscover action when advanced panel is opened", () => {
    render(<SiteContextSection projectId="proj-1" />);

    const toggle = screen.getByRole("button", { name: /Advanced actions/i });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: /Re-discover Competitors/i }),
    ).toBeInTheDocument();
  });
});
