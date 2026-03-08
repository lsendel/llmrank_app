import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, type Project } from "@/lib/api";
import type { PipelineStepId } from "./automation-tab-helpers";
import { useAutomationTabActions } from "./use-automation-tab-actions";

const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

function buildProject(
  skipSteps: string[] = ["keywords", "legacy_step"],
): Project {
  return {
    id: "proj-1",
    name: "Example",
    domain: "example.com",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    settings: {
      maxPages: 100,
      maxDepth: 3,
      schedule: "manual",
    },
    pipelineSettings: {
      autoRunOnCrawl: true,
      skipSteps,
    },
  };
}

describe("useAutomationTabActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.projects.rerunAutoGeneration = vi.fn(async () => undefined);
    api.pipeline.healthCheck = vi.fn(async () => ({
      projectId: "proj-1",
      crawlJobId: "crawl-1",
      score: 88,
      checks: [],
    }));
    api.pipeline.updateSettings = vi.fn(async () => undefined);
  });

  it("retries a failed rerun action and refreshes pipeline queries on success", async () => {
    const mutateLatest = vi.fn(async () => undefined);
    const mutateRuns = vi.fn(async () => undefined);
    const savedKnownSkipSteps: PipelineStepId[] = [];
    const savedUnknownSkipSteps: string[] = [];
    api.projects.rerunAutoGeneration = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("Boom"))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useAutomationTabActions({
        projectId: "proj-1",
        savedAutoRun: true,
        savedKnownSkipSteps,
        savedUnknownSkipSteps,
        mutateLatest,
        mutateRuns,
        mutateProject: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.handleRerun();
    });

    expect(result.current.actionError).toBe("Boom");
    expect(result.current.lastFailedAction).toBe("rerun");

    await act(async () => {
      await result.current.retryLastAction();
    });

    expect(api.projects.rerunAutoGeneration).toHaveBeenCalledTimes(2);
    expect(mutateLatest).toHaveBeenCalledTimes(1);
    expect(mutateRuns).toHaveBeenCalledTimes(1);
    expect(result.current.actionError).toBeNull();
    expect(result.current.lastFailedAction).toBeNull();
  });

  it("stores the health check result after a successful run", async () => {
    const savedKnownSkipSteps: PipelineStepId[] = [];
    const savedUnknownSkipSteps: string[] = [];
    const healthResult = {
      projectId: "proj-1",
      crawlJobId: "crawl-1",
      score: 91,
      checks: [
        {
          check: "crawler",
          category: "technical",
          status: "pass" as const,
          message: "Crawler healthy",
          autoFixable: false,
        },
      ],
    };
    api.pipeline.healthCheck = vi.fn(async () => healthResult);

    const { result } = renderHook(() =>
      useAutomationTabActions({
        projectId: "proj-1",
        savedAutoRun: true,
        savedKnownSkipSteps,
        savedUnknownSkipSteps,
        mutateLatest: vi.fn(async () => undefined),
        mutateRuns: vi.fn(async () => undefined),
        mutateProject: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.handleHealthCheck();
    });

    expect(api.pipeline.healthCheck).toHaveBeenCalledWith("proj-1");
    expect(result.current.healthResult).toEqual(healthResult);
    expect(result.current.actionError).toBeNull();
  });

  it("saves settings, mutates the cached project, and shows a success toast", async () => {
    const mutateProject = vi.fn(async () => undefined);
    const savedKnownSkipSteps: PipelineStepId[] = ["keywords"];
    const savedUnknownSkipSteps: string[] = ["legacy_step"];

    const { result } = renderHook(() =>
      useAutomationTabActions({
        projectId: "proj-1",
        savedAutoRun: true,
        savedKnownSkipSteps,
        savedUnknownSkipSteps,
        mutateLatest: vi.fn(async () => undefined),
        mutateRuns: vi.fn(async () => undefined),
        mutateProject,
      }),
    );

    act(() => {
      result.current.setAutoRunOnCrawl(false);
      result.current.handleSkipStepToggle("personas");
    });

    expect(result.current.settingsDirty).toBe(true);

    await act(async () => {
      await result.current.handleSaveSettings();
    });

    expect(api.pipeline.updateSettings).toHaveBeenCalledWith("proj-1", {
      autoRunOnCrawl: false,
      skipSteps: ["personas", "keywords", "legacy_step"],
    });
    expect(mutateProject).toHaveBeenCalledWith(expect.any(Function), {
      revalidate: false,
    });

    const projectUpdater = mutateProject.mock.calls[0]?.[0] as (
      current: Project | undefined,
    ) => Project | undefined;

    expect(projectUpdater(buildProject())?.pipelineSettings).toEqual({
      autoRunOnCrawl: false,
      skipSteps: ["personas", "keywords", "legacy_step"],
    });
    expect(toastMock).toHaveBeenCalledWith({
      title: "Pipeline settings saved",
      description: "Automation defaults were updated for future runs.",
    });
  });

  it("surfaces an ApiError when saving settings fails", async () => {
    const savedKnownSkipSteps: PipelineStepId[] = [];
    const savedUnknownSkipSteps: string[] = [];
    api.pipeline.updateSettings = vi.fn(async () => {
      throw new ApiError(400, "BAD_REQUEST", "Nope");
    });

    const { result } = renderHook(() =>
      useAutomationTabActions({
        projectId: "proj-1",
        savedAutoRun: true,
        savedKnownSkipSteps,
        savedUnknownSkipSteps,
        mutateLatest: vi.fn(async () => undefined),
        mutateRuns: vi.fn(async () => undefined),
        mutateProject: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.handleSaveSettings();
    });

    expect(result.current.settingsError).toBe("Nope");
    expect(toastMock).toHaveBeenCalledWith({
      title: "Failed to save settings",
      description: "Nope",
      variant: "destructive",
    });
  });
});
