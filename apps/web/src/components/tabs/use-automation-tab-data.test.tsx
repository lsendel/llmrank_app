import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PipelineRun, Project } from "@/lib/api";
import { useAutomationTabData } from "./use-automation-tab-data";

const {
  mockUseProject,
  mockUseApiSWR,
  mutateProject,
  mutateLatest,
  mutateRuns,
} = vi.hoisted(() => ({
  mockUseProject: vi.fn(),
  mockUseApiSWR: vi.fn(),
  mutateProject: vi.fn(async () => undefined),
  mutateLatest: vi.fn(async () => undefined),
  mutateRuns: vi.fn(async () => undefined),
}));

vi.mock("@/hooks/use-project", () => ({
  useProject: (...args: unknown[]) => mockUseProject(...args),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => mockUseApiSWR(...args),
}));

function buildProject(options?: {
  autoRunOnCrawl?: boolean;
  skipSteps?: string[];
}): Project {
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
      autoRunOnCrawl: options?.autoRunOnCrawl ?? true,
      skipSteps: options?.skipSteps ?? [],
    },
  };
}

function buildRun(options?: {
  id?: string;
  status?: PipelineRun["status"];
  stepResults?: PipelineRun["stepResults"];
}): PipelineRun {
  return {
    id: options?.id ?? "run-1",
    status: options?.status ?? "completed",
    currentStep: null,
    stepResults: options?.stepResults ?? null,
    startedAt: "2024-01-01T00:00:00.000Z",
    completedAt: "2024-01-01T00:05:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
  };
}

function configureSWR(overrides?: {
  latestRun?: PipelineRun | undefined;
  runs?: PipelineRun[] | undefined;
}) {
  mockUseApiSWR.mockImplementation((key: string) => {
    if (key === "pipeline-latest-proj-1") {
      return { data: overrides?.latestRun, mutate: mutateLatest };
    }
    if (key === "pipeline-runs-proj-1") {
      return { data: overrides?.runs, mutate: mutateRuns };
    }
    return { data: undefined };
  });
}

describe("useAutomationTabData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives saved settings, failed steps, and run metrics from project and pipeline data", () => {
    const latestRun = buildRun({
      id: "run-latest",
      status: "failed",
      stepResults: {
        keywords: { status: "failed", error: "Keyword step failed" },
      },
    });
    const runs = [
      buildRun({ id: "run-success" }),
      buildRun({
        id: "run-failed",
        status: "failed",
        stepResults: {
          personas: { status: "failed", error: "Persona step failed" },
        },
      }),
    ];

    mockUseProject.mockReturnValue({
      data: buildProject({
        autoRunOnCrawl: false,
        skipSteps: ["personas", "legacy_step"],
      }),
      mutate: mutateProject,
    });
    configureSWR({ latestRun, runs });

    const { result } = renderHook(() => useAutomationTabData("proj-1"));

    expect(result.current.latestRun).toBe(latestRun);
    expect(result.current.runs).toBe(runs);
    expect(result.current.savedAutoRun).toBe(false);
    expect(result.current.savedKnownSkipSteps).toEqual(["personas"]);
    expect(result.current.savedUnknownSkipSteps).toEqual(["legacy_step"]);
    expect(result.current.failedSteps).toEqual([
      { step: "keywords", error: "Keyword step failed" },
    ]);
    expect(result.current.totalRuns).toBe(2);
    expect(result.current.failedRuns).toBe(1);
    expect(result.current.successRate).toBe(50);
    expect(result.current.settingsReady).toBe(true);
    expect(result.current.mutateProject).toBe(mutateProject);
    expect(result.current.mutateLatest).toBe(mutateLatest);
    expect(result.current.mutateRuns).toBe(mutateRuns);
  });

  it("falls back safely when project or pipeline data is missing", () => {
    mockUseProject.mockReturnValue({
      data: undefined,
      mutate: mutateProject,
    });
    configureSWR({ latestRun: undefined, runs: undefined });

    const { result } = renderHook(() => useAutomationTabData("proj-1"));

    expect(result.current.latestRun).toBeUndefined();
    expect(result.current.runs).toBeUndefined();
    expect(result.current.savedAutoRun).toBe(true);
    expect(result.current.savedKnownSkipSteps).toEqual([]);
    expect(result.current.savedUnknownSkipSteps).toEqual([]);
    expect(result.current.failedSteps).toEqual([]);
    expect(result.current.totalRuns).toBe(0);
    expect(result.current.failedRuns).toBe(0);
    expect(result.current.successRate).toBe(0);
    expect(result.current.settingsReady).toBe(false);
  });
});
