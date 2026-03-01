import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AiFixButton } from "@/components/ai-fix-button";
import { api } from "@/lib/api";
import { track } from "@/lib/telemetry";
import { vi } from "vitest";

const toastMock = vi.fn();

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    fixes: {
      generate: vi.fn(),
    },
  },
}));

describe("AiFixButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tracks optimize click and requests fix generation", async () => {
    vi.mocked(api.fixes.generate).mockResolvedValue({
      generatedFix: "Use descriptive, intent-aligned title tags.",
    } as never);

    render(
      <AiFixButton
        projectId="proj-1"
        pageId="page-1"
        issueCode="MISSING_TITLE"
        issueTitle="Missing title"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "AI Fix" }));

    expect(track).toHaveBeenCalledWith(
      "issue_optimize_ai_clicked",
      expect.objectContaining({
        projectId: "proj-1",
        pageId: "page-1",
        issueCode: "MISSING_TITLE",
        surface: "issue_card",
      }),
    );

    await waitFor(() => {
      expect(api.fixes.generate).toHaveBeenCalledWith({
        projectId: "proj-1",
        pageId: "page-1",
        issueCode: "MISSING_TITLE",
      });
    });
  });
});
