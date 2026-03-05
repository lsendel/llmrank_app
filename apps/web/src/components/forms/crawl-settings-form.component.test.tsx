import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CrawlSettingsForm } from "./crawl-settings-form";

const mockProjectUpdate = vi.fn();
const mockIsHttpFallbackEnabled = vi.fn();

vi.mock("@/lib/use-api", () => ({
  useApi: () => ({
    withAuth: async <T,>(fn: () => Promise<T>) => fn(),
  }),
}));

vi.mock("@/hooks/use-plan", () => ({
  usePlan: () => ({
    isFree: true,
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    projects: {
      update: (...args: unknown[]) => mockProjectUpdate(...args),
    },
    public: {
      isHttpFallbackEnabled: (...args: unknown[]) =>
        mockIsHttpFallbackEnabled(...args),
    },
  },
}));

describe("CrawlSettingsForm advanced controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectUpdate.mockResolvedValue({});
    mockIsHttpFallbackEnabled.mockResolvedValue(false);
  });

  it("starts with advanced controls collapsed for default settings", () => {
    render(
      <CrawlSettingsForm
        projectId="proj-1"
        initialSettings={{ schedule: "manual", ignoreRobots: false }}
      />,
    );

    const toggle = screen.getByRole("button", {
      name: /Advanced crawl controls/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByLabelText("Ignore robots.txt"),
    ).not.toBeInTheDocument();
  });

  it("auto-expands advanced controls when advanced flags are pre-enabled", () => {
    render(
      <CrawlSettingsForm
        projectId="proj-1"
        initialSettings={{ schedule: "manual", ignoreRobots: true }}
      />,
    );

    const toggle = screen.getByRole("button", {
      name: /Advanced crawl controls/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Ignore robots.txt")).toBeInTheDocument();
  });

  it("reveals advanced controls after manual toggle", () => {
    render(
      <CrawlSettingsForm
        projectId="proj-1"
        initialSettings={{ schedule: "manual", ignoreRobots: false }}
      />,
    );

    const toggle = screen.getByRole("button", {
      name: /Advanced crawl controls/i,
    });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Ignore robots.txt")).toBeInTheDocument();
  });
});
