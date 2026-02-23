import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPipelineRuns = {
  create: vi
    .fn()
    .mockResolvedValue({ id: "run-1", status: "pending", stepResults: {} }),
  getById: vi.fn().mockResolvedValue(null),
  updateStatus: vi.fn().mockResolvedValue({ id: "run-1" }),
  updateStep: vi.fn().mockResolvedValue({ id: "run-1" }),
};

const mockProjectQueries = {
  getById: vi.fn().mockResolvedValue({
    id: "proj-1",
    userId: "user-1",
    domain: "example.com",
    pipelineSettings: { autoRunOnCrawl: true, skipSteps: [] },
  }),
};

const mockAudit = {
  emitEvent: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@llm-boost/db", () => ({
  pipelineRunQueries: () => mockPipelineRuns,
  projectQueries: () => mockProjectQueries,
}));

vi.mock("../../../services/auto-site-description-service", () => ({
  runAutoSiteDescription: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../services/auto-persona-service", () => ({
  runAutoPersonaGeneration: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../services/auto-keyword-service", () => ({
  runAutoKeywordGeneration: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../services/auto-competitor-service", () => ({
  runAutoCompetitorDiscovery: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../services/auto-visibility-service", () => ({
  runAutoVisibilityChecks: vi.fn().mockResolvedValue(undefined),
}));

import { createPipelineService } from "../../services/pipeline-service";

describe("PipelineService", () => {
  const fakeDb = {} as any;
  const fakeKeys = {
    databaseUrl: "postgresql://test",
    anthropicApiKey: "sk-test",
    perplexityApiKey: "pplx-test",
    grokApiKey: "grok-test",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPipelineRuns.getById.mockResolvedValue({
      id: "run-1",
      status: "completed",
      stepResults: {},
    });
  });

  it("creates a pipeline run with pending status", async () => {
    const service = createPipelineService(fakeDb, mockAudit as any, fakeKeys);
    const run = await service.start("proj-1", "crawl-1");

    expect(mockPipelineRuns.create).toHaveBeenCalledWith({
      projectId: "proj-1",
      crawlJobId: "crawl-1",
      settings: { autoRunOnCrawl: true, skipSteps: [] },
    });
    expect(run).toMatchObject({ id: "run-1" });
  });

  it("emits pipeline.started audit event", async () => {
    const service = createPipelineService(fakeDb, mockAudit as any, fakeKeys);
    await service.start("proj-1", "crawl-1");

    expect(mockAudit.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "pipeline.started" }),
    );
  });

  it("emits pipeline.completed audit event on success", async () => {
    const service = createPipelineService(fakeDb, mockAudit as any, fakeKeys);
    await service.start("proj-1", "crawl-1");

    expect(mockAudit.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "pipeline.completed" }),
    );
  });

  it("marks run as completed after all steps", async () => {
    const service = createPipelineService(fakeDb, mockAudit as any, fakeKeys);
    await service.start("proj-1", "crawl-1");

    expect(mockPipelineRuns.updateStatus).toHaveBeenCalledWith(
      "run-1",
      "completed",
      expect.objectContaining({ completedAt: expect.any(Date) }),
    );
  });

  it("skips steps listed in skipSteps setting", async () => {
    mockProjectQueries.getById.mockResolvedValueOnce({
      id: "proj-1",
      userId: "user-1",
      domain: "example.com",
      pipelineSettings: {
        autoRunOnCrawl: true,
        skipSteps: ["competitors", "visibility_check"],
      },
    });

    const service = createPipelineService(fakeDb, mockAudit as any, fakeKeys);
    await service.start("proj-1", "crawl-1");

    expect(mockAudit.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "pipeline.step.skipped",
        metadata: expect.objectContaining({ step: "competitors" }),
      }),
    );
    expect(mockAudit.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "pipeline.step.skipped",
        metadata: expect.objectContaining({ step: "visibility_check" }),
      }),
    );
  });

  it("throws if project not found", async () => {
    mockProjectQueries.getById.mockResolvedValueOnce(null);
    const service = createPipelineService(fakeDb, mockAudit as any, fakeKeys);
    await expect(service.start("bad-proj", "crawl-1")).rejects.toThrow(
      "Project not found",
    );
  });
});
