import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMonitoringService } from "../../services/monitoring-service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Shared logger instance so tests can assert on log.error / log.info. Hoisted
// so the vi.mock factory (also hoisted) can close over it.
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  },
}));

vi.mock("@llm-boost/shared", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@llm-boost/shared")>();
  return {
    ...orig,
    createLogger: vi.fn(() => mockLogger),
  };
});

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockDb(
  selectResults: Record<string, unknown[][]> = {},
  updateFn?: ReturnType<typeof vi.fn>,
) {
  const selectMock = vi.fn();
  const fromMock = vi.fn();
  const whereMock = vi.fn();
  const setMock = vi.fn();
  const whereUpdateMock = vi.fn();
  const _limitMock = vi.fn();

  let callIndex = 0;

  // Chain for select().from().where()
  selectMock.mockReturnValue({ from: fromMock });
  fromMock.mockReturnValue({ where: whereMock });
  whereMock.mockImplementation(() => {
    const _key = `query_${callIndex++}`;
    const results = Object.values(selectResults)[callIndex - 1] ?? [];
    return Promise.resolve(results);
  });

  // Chain for update().set().where()
  const updateMock = vi.fn().mockReturnValue({ set: setMock });
  setMock.mockReturnValue({ where: whereUpdateMock });
  whereUpdateMock.mockResolvedValue(undefined);

  // Raw-SQL aggregate path (db.all(sql`…`)), used by checkLlmScorePopulation.
  const allMock = vi.fn().mockResolvedValue([]);

  return {
    select: selectMock,
    update: updateFn ?? updateMock,
    all: allMock,
    _fromMock: fromMock,
    _whereMock: whereMock,
    _allMock: allMock,
    _updateMock: updateFn ?? updateMock,
    _setMock: setMock,
    _whereUpdateMock: whereUpdateMock,
  } as any;
}

function createMockKv(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    get: vi.fn(async (key: string) => store[key] ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    _store: store,
  };
}

function createMockNotifier() {
  return {
    queueEmail: vi.fn().mockResolvedValue(undefined),
    sendCrawlComplete: vi.fn().mockResolvedValue(undefined),
    sendScoreDrop: vi.fn().mockResolvedValue(undefined),
    processQueue: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MonitoringService", () => {
  let notifier: ReturnType<typeof createMockNotifier>;

  beforeEach(() => {
    vi.clearAllMocks();
    notifier = createMockNotifier();
  });

  describe("checkSystemHealth", () => {
    it("does nothing when no stalled jobs are found", async () => {
      // select().from().where() returns empty array for stalled jobs
      const db = createMockDb();
      db._whereMock.mockResolvedValueOnce([]); // no stalled jobs

      const service = createMonitoringService(db, notifier as any);
      await expect(service.checkSystemHealth()).resolves.toBeUndefined();
    });

    it("marks stalled jobs as failed", async () => {
      const stalledJob = { id: "job-stalled", status: "crawling" };
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });

      const db = createMockDb();
      db._whereMock.mockResolvedValueOnce([stalledJob]);
      db.update = updateMock;

      const service = createMonitoringService(db, notifier as any);
      await service.checkSystemHealth();

      expect(updateMock).toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          errorMessage: expect.stringContaining("stalled"),
        }),
      );
    });

    it("handles multiple stalled jobs", async () => {
      const stalledJobs = [
        { id: "job-1", status: "crawling" },
        { id: "job-2", status: "scoring" },
      ];
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });

      const db = createMockDb();
      db._whereMock.mockResolvedValueOnce(stalledJobs);
      db.update = updateMock;

      const service = createMonitoringService(db, notifier as any);
      await service.checkSystemHealth();

      expect(updateMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("checkLlmScorePopulation", () => {
    function makeHistory(rates: number[]): string {
      return JSON.stringify(
        rates.map((rate, i) => ({
          checkedAt: new Date(2026, 0, i + 1).toISOString(),
          totalScored: 100,
          populated: Math.round(rate * 100),
          rate,
        })),
      );
    }

    it("skips low-volume windows without recording a baseline sample", async () => {
      const db = createMockDb();
      db._allMock.mockResolvedValueOnce([{ total: 5, populated: 5 }]);
      const kv = createMockKv();

      const service = createMonitoringService(db, notifier as any);
      await service.checkLlmScorePopulation(kv as any);

      // Too few scored pages → no history written, no alert.
      expect(kv.put).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it("records a healthy sample when no baseline exists yet", async () => {
      const db = createMockDb();
      db._allMock.mockResolvedValueOnce([{ total: 100, populated: 42 }]);
      const kv = createMockKv();

      const service = createMonitoringService(db, notifier as any);
      await service.checkLlmScorePopulation(kv as any);

      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(kv.put).toHaveBeenCalledWith(
        "llm:score:population:history",
        expect.stringContaining('"rate":0.42'),
        expect.objectContaining({ expirationTtl: expect.any(Number) }),
      );
    });

    it("alerts when population collapses relative to its baseline (#108)", async () => {
      const db = createMockDb();
      // 1/100 populated now, but the trailing history sat near 50%.
      db._allMock.mockResolvedValueOnce([{ total: 100, populated: 1 }]);
      const kv = createMockKv({
        "llm:score:population:history": makeHistory([0.5, 0.48, 0.52, 0.5]),
      });

      const service = createMonitoringService(db, notifier as any);
      await service.checkLlmScorePopulation(kv as any);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("population dropped sharply"),
        expect.objectContaining({ totalScored: 100, populated: 1 }),
      );
    });

    it("does NOT alert on an organic dip within the baseline band", async () => {
      const db = createMockDb();
      // 35% now vs a ~50% baseline — a dip, but not a collapse (> 25% of median).
      db._allMock.mockResolvedValueOnce([{ total: 100, populated: 35 }]);
      const kv = createMockKv({
        "llm:score:population:history": makeHistory([0.5, 0.48, 0.52, 0.5]),
      });

      const service = createMonitoringService(db, notifier as any);
      await service.checkLlmScorePopulation(kv as any);

      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(kv.put).toHaveBeenCalled();
    });

    it("does NOT alert when LLM scoring was never meaningfully populated", async () => {
      const db = createMockDb();
      // Everything at ~0 now, but the baseline was also ~0 (e.g. all free-tier
      // crawls) — nothing broke, so no false alarm.
      db._allMock.mockResolvedValueOnce([{ total: 100, populated: 0 }]);
      const kv = createMockKv({
        "llm:score:population:history": makeHistory([0.0, 0.01, 0.0, 0.0]),
      });

      const service = createMonitoringService(db, notifier as any);
      await service.checkLlmScorePopulation(kv as any);

      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe("getSystemMetrics", () => {
    it("returns metrics with active crawls and errors", async () => {
      const db = createMockDb();
      db._whereMock
        .mockResolvedValueOnce([{ count: 3 }]) // active crawls
        .mockResolvedValueOnce([{ count: 1 }]); // errors last 24h

      const service = createMonitoringService(db, notifier as any);
      const metrics = await service.getSystemMetrics();

      expect(metrics).toEqual({
        activeCrawls: 3,
        errorsLast24h: 1,
        systemTime: expect.any(String),
      });
    });

    it("returns zero counts when no results", async () => {
      const db = createMockDb();
      db._whereMock
        .mockResolvedValueOnce([{}]) // no count property
        .mockResolvedValueOnce([{}]);

      const service = createMonitoringService(db, notifier as any);
      const metrics = await service.getSystemMetrics();

      expect(metrics.activeCrawls).toBe(0);
      expect(metrics.errorsLast24h).toBe(0);
    });

    it("includes systemTime as ISO string", async () => {
      const db = createMockDb();
      db._whereMock
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }]);

      const service = createMonitoringService(db, notifier as any);
      const metrics = await service.getSystemMetrics();

      // Verify it's a valid ISO date
      expect(new Date(metrics.systemTime as string).toISOString()).toBe(
        metrics.systemTime,
      );
    });
  });

  describe("checkCrawlerHealth", () => {
    it("stores healthy status in KV when crawler responds OK", async () => {
      const kv = { put: vi.fn(), get: vi.fn().mockResolvedValue(null) };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: "ok" }),
      });

      const db = createMockDb();
      db._whereMock.mockResolvedValueOnce([]); // for stalled jobs check
      const service = createMonitoringService(db, notifier as any);
      await service.checkCrawlerHealth("https://crawler.test", kv as any);

      expect(kv.put).toHaveBeenCalledWith(
        "crawler:health:latest",
        expect.stringContaining('"status":"up"'),
        expect.objectContaining({ expirationTtl: 3600 }),
      );
    });

    it("stores down status when crawler responds with error", async () => {
      const kv = { put: vi.fn(), get: vi.fn().mockResolvedValue(null) };
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      const db = createMockDb();
      db._whereMock.mockResolvedValueOnce([]);
      const service = createMonitoringService(db, notifier as any);
      await service.checkCrawlerHealth("https://crawler.test", kv as any);

      expect(kv.put).toHaveBeenCalledWith(
        "crawler:health:latest",
        expect.stringContaining('"status":"down"'),
        expect.objectContaining({ expirationTtl: 3600 }),
      );
    });

    it("stores down status when fetch throws", async () => {
      const kv = { put: vi.fn(), get: vi.fn().mockResolvedValue(null) };
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const db = createMockDb();
      db._whereMock.mockResolvedValueOnce([]);
      const service = createMonitoringService(db, notifier as any);
      await service.checkCrawlerHealth("https://crawler.test", kv as any);

      expect(kv.put).toHaveBeenCalledWith(
        "crawler:health:latest",
        expect.stringContaining('"status":"down"'),
        expect.objectContaining({ expirationTtl: 3600 }),
      );
    });
  });
});
