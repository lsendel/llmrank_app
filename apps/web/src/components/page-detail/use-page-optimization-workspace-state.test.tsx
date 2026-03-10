import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionItem, PageScoreDetail } from "@/lib/api";
import { usePageOptimizationWorkspaceState } from "./use-page-optimization-workspace-state";

const toastMock = vi.fn();
const mutateMock = vi.fn().mockResolvedValue(undefined);
const useApiSWRMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();

const page: PageScoreDetail = {
  id: "page-1",
  jobId: "job-1",
  url: "https://example.com/page",
  canonicalUrl: null,
  statusCode: 200,
  title: null,
  metaDesc: null,
  wordCount: 500,
  contentHash: null,
  crawledAt: null,
  score: {
    overallScore: 81,
    technicalScore: 80,
    contentScore: 82,
    aiReadinessScore: 79,
    lighthousePerf: 85,
    lighthouseSeo: 88,
    letterGrade: "B",
    detail: { extracted: { h1: ["Original H1"], internal_links: [] } },
    platformScores: null,
    recommendations: [
      {
        issueCode: "MISSING_TITLE",
        title: "Add a title",
        description: "Write a concise title",
        priority: "high",
        effort: "low",
        impact: "high",
        estimatedImprovement: 82,
        affectedPlatforms: ["chatgpt"],
        example: { before: "", after: "Better page title" },
      },
    ],
  },
  issues: [
    {
      code: "MISSING_TITLE",
      category: "content",
      severity: "critical",
      message: "Title missing",
      recommendation: "Add a title",
    },
  ],
};

function makeActionItem(
  overrides: Partial<ActionItem> &
    Pick<ActionItem, "id" | "issueCode" | "status">,
): ActionItem {
  return {
    id: overrides.id,
    projectId: "proj-1",
    pageId: "page-1",
    issueCode: overrides.issueCode,
    status: overrides.status,
    severity: "warning",
    category: "content",
    scoreImpact: 50,
    title: "Task",
    description: null,
    assigneeId: null,
    dueAt: null,
    verifiedAt: null,
    verifiedByCrawlId: null,
    createdAt: "2026-03-09T00:00:00.000Z",
    updatedAt: "2026-03-09T00:00:00.000Z",
    ...overrides,
  };
}

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/auth-hooks", () => ({
  useUser: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => useApiSWRMock(...args),
}));

vi.mock("@/lib/api", () => ({
  api: {
    actionItems: {
      list: vi.fn(),
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

describe("usePageOptimizationWorkspaceState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useApiSWRMock.mockReturnValue({
      data: [],
      mutate: mutateMock,
    });
    createMock.mockResolvedValue({ id: "created" });
    updateMock.mockResolvedValue({ id: "updated" });
  });

  it("creates a new action item with the selected due date and assignee", async () => {
    const { result } = renderHook(() =>
      usePageOptimizationWorkspaceState({ page, projectId: "proj-1" }),
    );

    act(() => {
      result.current.handleSuggestedChange("title", "Ship this improved title");
      result.current.handleDueDateChange("title", "2026-03-20");
    });

    await act(async () => {
      await result.current.handleSaveTask(result.current.items[0]!.task);
    });

    expect(createMock).toHaveBeenCalledWith({
      projectId: "proj-1",
      pageId: "page-1",
      issueCode: "MISSING_TITLE",
      status: "pending",
      severity: "critical",
      category: "content",
      scoreImpact: 82,
      title: "Title missing",
      description: "Ship this improved title",
      assigneeId: "user-1",
      dueAt: "2026-03-20T12:00:00.000Z",
    });
    expect(mutateMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Task saved" }),
    );
  });

  it("updates an existing page-scoped action item", async () => {
    useApiSWRMock.mockReturnValue({
      data: [
        makeActionItem({
          id: "item-1",
          issueCode: "MISSING_TITLE",
          status: "in_progress",
        }),
      ],
      mutate: mutateMock,
    });

    const { result } = renderHook(() =>
      usePageOptimizationWorkspaceState({ page, projectId: "proj-1" }),
    );

    act(() => {
      result.current.handleSuggestedChange("title", "Refresh the title draft");
      result.current.handleDueDateChange("title", "2026-03-22");
    });

    await act(async () => {
      await result.current.handleSaveTask(result.current.items[0]!.task);
    });

    expect(updateMock).toHaveBeenCalledWith("item-1", {
      assigneeId: "user-1",
      dueAt: "2026-03-22T12:00:00.000Z",
      description: "Refresh the title draft",
      status: "in_progress",
    });
    expect(createMock).not.toHaveBeenCalled();
    expect(mutateMock).toHaveBeenCalled();
  });
});
