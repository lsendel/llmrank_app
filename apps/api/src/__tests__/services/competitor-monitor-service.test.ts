import { describe, it, expect } from "vitest";
import {
  createCompetitorMonitorService,
  computeNextBenchmarkAt,
} from "../../services/competitor-monitor-service";

// ── Test doubles (no mocks per project policy) ──────────────────────

function makeBenchmark(overrides: Record<string, unknown> = {}) {
  return {
    id: "bench-new",
    overallScore: 80,
    technicalScore: 75,
    contentScore: 70,
    aiReadinessScore: 65,
    performanceScore: 85,
    llmsTxtScore: 0,
    robotsTxtScore: 50,
    sitemapScore: 80,
    schemaMarkupScore: 60,
    botAccessScore: 0,
    ...overrides,
  };
}

function makeCompetitor(overrides: Record<string, unknown> = {}) {
  return {
    id: "comp-1",
    projectId: "proj-1",
    domain: "example.com",
    monitoringEnabled: true,
    monitoringFrequency: "weekly" as const,
    nextBenchmarkAt: null,
    lastBenchmarkAt: null,
    ...overrides,
  };
}

function createTestDeps(options: {
  dueCompetitors?: ReturnType<typeof makeCompetitor>[];
  previousBenchmark?: ReturnType<typeof makeBenchmark> | null;
  newBenchmark?: ReturnType<typeof makeBenchmark>;
  benchmarkError?: Error;
}) {
  const calls = {
    updateMonitoring: [] as { id: string; data: any }[],
    eventsCreated: [] as any[],
    outboxEnqueued: [] as any[],
    benchmarksRequested: [] as any[],
  };

  return {
    calls,
    deps: {
      competitors: {
        async listDueForBenchmark(_now: Date, _limit?: number) {
          return options.dueCompetitors ?? [];
        },
        async updateMonitoring(id: string, data: any) {
          calls.updateMonitoring.push({ id, data });
          return {};
        },
      },
      competitorBenchmarks: {
        async getLatest(_projectId: string, _domain: string) {
          return options.previousBenchmark ?? null;
        },
        async create(_data: any) {
          return {};
        },
      },
      competitorEvents: {
        async create(data: any) {
          calls.eventsCreated.push(data);
          return {};
        },
      },
      outbox: {
        async enqueue(data: any) {
          calls.outboxEnqueued.push(data);
          return {};
        },
      },
      benchmarkService: {
        async benchmarkCompetitor(args: any) {
          calls.benchmarksRequested.push(args);
          if (options.benchmarkError) throw options.benchmarkError;
          return options.newBenchmark ?? makeBenchmark();
        },
      },
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("computeNextBenchmarkAt", () => {
  it("returns +1 day for daily frequency", () => {
    const before = Date.now();
    const next = computeNextBenchmarkAt("daily");
    const diff = next.getTime() - before;
    // ~24 hours in ms, allow 1s tolerance
    expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(25 * 60 * 60 * 1000);
  });

  it("returns +7 days for weekly frequency", () => {
    const before = Date.now();
    const next = computeNextBenchmarkAt("weekly");
    const diff = next.getTime() - before;
    expect(diff).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(8 * 24 * 60 * 60 * 1000);
  });

  it("defaults to +7 days for unknown frequency", () => {
    const before = Date.now();
    const next = computeNextBenchmarkAt("unknown");
    const diff = next.getTime() - before;
    expect(diff).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(8 * 24 * 60 * 60 * 1000);
  });
});

describe("processScheduledBenchmarks", () => {
  it("returns zeros when no competitors are due", async () => {
    const { deps } = createTestDeps({ dueCompetitors: [] });
    const service = createCompetitorMonitorService(deps);

    const results = await service.processScheduledBenchmarks();
    expect(results).toEqual({ processed: 0, events: 0, errors: 0 });
  });

  it("processes due competitor and creates events from diff", async () => {
    const previous = makeBenchmark({ overallScore: 90 });
    const current = makeBenchmark({ overallScore: 75 }); // -15 → score_regression

    const { deps, calls } = createTestDeps({
      dueCompetitors: [makeCompetitor()],
      previousBenchmark: previous,
      newBenchmark: current,
    });
    const service = createCompetitorMonitorService(deps);

    const results = await service.processScheduledBenchmarks();
    expect(results.processed).toBe(1);
    expect(results.events).toBeGreaterThan(0);
    expect(results.errors).toBe(0);

    // Should have stored the regression event
    const regressionEvent = calls.eventsCreated.find(
      (e) => e.eventType === "score_regression",
    );
    expect(regressionEvent).toBeDefined();
    expect(regressionEvent.projectId).toBe("proj-1");
    expect(regressionEvent.competitorDomain).toBe("example.com");
    expect(regressionEvent.benchmarkId).toBe("bench-new");
  });

  it("updates monitoring schedule after successful benchmark", async () => {
    const { deps, calls } = createTestDeps({
      dueCompetitors: [makeCompetitor({ monitoringFrequency: "weekly" })],
      previousBenchmark: null,
      newBenchmark: makeBenchmark(),
    });
    const service = createCompetitorMonitorService(deps);

    await service.processScheduledBenchmarks();

    expect(calls.updateMonitoring).toHaveLength(1);
    expect(calls.updateMonitoring[0].id).toBe("comp-1");
    expect(calls.updateMonitoring[0].data.lastBenchmarkAt).toBeInstanceOf(Date);
    expect(calls.updateMonitoring[0].data.nextBenchmarkAt).toBeInstanceOf(Date);
  });

  it("emits outbox events for warning severity", async () => {
    // Score regression produces a "warning" event
    const previous = makeBenchmark({ overallScore: 90 });
    const current = makeBenchmark({ overallScore: 75 });

    const { deps, calls } = createTestDeps({
      dueCompetitors: [makeCompetitor()],
      previousBenchmark: previous,
      newBenchmark: current,
    });
    const service = createCompetitorMonitorService(deps);

    await service.processScheduledBenchmarks();

    expect(calls.outboxEnqueued.length).toBeGreaterThan(0);
    const alert = calls.outboxEnqueued[0];
    expect(alert.type).toBe("webhook:alert");
    expect(alert.eventType).toContain("competitor_");
    expect(alert.projectId).toBe("proj-1");
  });

  it("emits outbox events for critical severity", async () => {
    // llms.txt added produces a "critical" event
    const previous = makeBenchmark({ llmsTxtScore: 0 });
    const current = makeBenchmark({ llmsTxtScore: 85 });

    const { deps, calls } = createTestDeps({
      dueCompetitors: [makeCompetitor()],
      previousBenchmark: previous,
      newBenchmark: current,
    });
    const service = createCompetitorMonitorService(deps);

    await service.processScheduledBenchmarks();

    const criticalAlert = calls.outboxEnqueued.find(
      (e) => e.eventType === "competitor_llms_txt_added",
    );
    expect(criticalAlert).toBeDefined();
  });

  it("does NOT emit outbox for info-only events", async () => {
    // Schema added produces an "info" event only
    const previous = makeBenchmark({ schemaMarkupScore: 0 });
    const current = makeBenchmark({ schemaMarkupScore: 70 });

    const { deps, calls } = createTestDeps({
      dueCompetitors: [makeCompetitor()],
      previousBenchmark: previous,
      newBenchmark: current,
    });
    const service = createCompetitorMonitorService(deps);

    await service.processScheduledBenchmarks();

    // Events created but no outbox enqueue for info severity
    expect(calls.eventsCreated.length).toBeGreaterThan(0);
    expect(calls.outboxEnqueued).toHaveLength(0);
  });

  it("handles benchmark failure gracefully and still advances schedule", async () => {
    const { deps, calls } = createTestDeps({
      dueCompetitors: [makeCompetitor({ monitoringFrequency: "daily" })],
      benchmarkError: new Error("Crawler timeout"),
    });
    const service = createCompetitorMonitorService(deps);

    const results = await service.processScheduledBenchmarks();

    expect(results.errors).toBe(1);
    expect(results.processed).toBe(0);

    // Still advances nextBenchmarkAt to avoid infinite retry loop
    expect(calls.updateMonitoring).toHaveLength(1);
    expect(calls.updateMonitoring[0].data.nextBenchmarkAt).toBeInstanceOf(Date);
    // lastBenchmarkAt should NOT be set on failure
    expect(calls.updateMonitoring[0].data.lastBenchmarkAt).toBeUndefined();
  });

  it("processes multiple competitors independently", async () => {
    const compA = makeCompetitor({ id: "comp-a", domain: "alpha.com" });
    const compB = makeCompetitor({ id: "comp-b", domain: "beta.com" });

    const { deps, calls } = createTestDeps({
      dueCompetitors: [compA, compB],
      previousBenchmark: null,
      newBenchmark: makeBenchmark(),
    });
    const service = createCompetitorMonitorService(deps);

    const results = await service.processScheduledBenchmarks();

    expect(results.processed).toBe(2);
    expect(calls.benchmarksRequested).toHaveLength(2);
    expect(calls.benchmarksRequested[0].competitorDomain).toBe("alpha.com");
    expect(calls.benchmarksRequested[1].competitorDomain).toBe("beta.com");
  });

  it("continues processing remaining competitors when one fails", async () => {
    const compA = makeCompetitor({ id: "comp-a", domain: "alpha.com" });
    const compB = makeCompetitor({ id: "comp-b", domain: "beta.com" });

    let callCount = 0;
    const { deps, calls } = createTestDeps({
      dueCompetitors: [compA, compB],
      previousBenchmark: null,
    });
    // Override to fail on first call only
    deps.benchmarkService.benchmarkCompetitor = async (args: any) => {
      calls.benchmarksRequested.push(args);
      callCount++;
      if (callCount === 1) throw new Error("First competitor failed");
      return makeBenchmark();
    };
    const service = createCompetitorMonitorService(deps);

    const results = await service.processScheduledBenchmarks();

    expect(results.processed).toBe(1);
    expect(results.errors).toBe(1);
    // Both should have their schedule updated
    expect(calls.updateMonitoring).toHaveLength(2);
  });

  it("passes limit of 20 to listDueForBenchmark", async () => {
    let capturedLimit: number | undefined;
    const { deps } = createTestDeps({ dueCompetitors: [] });
    deps.competitors.listDueForBenchmark = async (
      _now: Date,
      limit?: number,
    ) => {
      capturedLimit = limit;
      return [];
    };
    const service = createCompetitorMonitorService(deps);

    await service.processScheduledBenchmarks();

    expect(capturedLimit).toBe(20);
  });

  it("produces no events when previous benchmark is null (first run)", async () => {
    const { deps, calls } = createTestDeps({
      dueCompetitors: [makeCompetitor()],
      previousBenchmark: null,
      newBenchmark: makeBenchmark(),
    });
    const service = createCompetitorMonitorService(deps);

    const results = await service.processScheduledBenchmarks();

    expect(results.processed).toBe(1);
    expect(results.events).toBe(0);
    expect(calls.eventsCreated).toHaveLength(0);
    expect(calls.outboxEnqueued).toHaveLength(0);
  });
});
