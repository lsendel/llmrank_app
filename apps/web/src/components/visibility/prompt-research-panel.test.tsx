import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptResearchPanel } from "./prompt-research-panel";
import type { AIPrompt } from "@/lib/api";

const mutateMock = vi.fn().mockResolvedValue(undefined);
const toastMock = vi.fn();
const checkMock = vi.fn();
const trackScheduleMock = vi.fn();

const mockPrompts: AIPrompt[] = [
  {
    id: "prompt-1",
    projectId: "proj-1",
    prompt: "best ai seo tools for saas",
    category: "comparison",
    estimatedVolume: 1200,
    difficulty: 48,
    intent: "informational",
    yourMentioned: false,
    competitorsMentioned: ["competitor.com"],
    source: "discovered",
    discoveredAt: new Date().toISOString(),
  },
];

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: vi.fn(() => ({
    data: { data: mockPrompts, meta: { limit: 20, plan: "starter" } },
    isLoading: false,
    error: null,
    mutate: mutateMock,
  })),
}));

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  api: {
    promptResearch: {
      list: vi.fn(),
      discover: vi.fn(),
      remove: vi.fn(),
      check: (...args: unknown[]) => checkMock(...args),
    },
    visibility: {
      schedules: {
        create: (...args: unknown[]) => trackScheduleMock(...args),
      },
    },
  },
}));

describe("PromptResearchPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkMock.mockResolvedValue({
      promptId: "prompt-1",
      prompt: "best ai seo tools for saas",
      checkCount: 1,
      yourMentioned: true,
      competitorsMentioned: ["competitor.com"],
      checks: [],
    });
    trackScheduleMock.mockResolvedValue({ id: "schedule-1" });
  });

  it("runs a prompt visibility check and refreshes data", async () => {
    render(<PromptResearchPanel projectId="proj-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Run Check" }));

    await waitFor(() =>
      expect(checkMock).toHaveBeenCalledWith({
        projectId: "proj-1",
        promptId: "prompt-1",
      }),
    );
    expect(mutateMock).toHaveBeenCalled();
  });

  it("passes selected locale filters to prompt checks", async () => {
    render(
      <PromptResearchPanel
        projectId="proj-1"
        filters={{ region: "gb", language: "en" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run Check" }));

    await waitFor(() =>
      expect(checkMock).toHaveBeenCalledWith({
        projectId: "proj-1",
        promptId: "prompt-1",
        region: "gb",
        language: "en",
      }),
    );
  });

  it("creates a weekly tracking schedule from prompt actions", async () => {
    render(<PromptResearchPanel projectId="proj-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Track Weekly" }));

    await waitFor(() =>
      expect(trackScheduleMock).toHaveBeenCalledWith({
        projectId: "proj-1",
        query: "best ai seo tools for saas",
        providers: ["chatgpt", "claude", "perplexity", "gemini"],
        frequency: "weekly",
      }),
    );
  });
});
