import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMonitoringService } from "../../services/monitoring-service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../lib/logger", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

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

  return {
    select: selectMock,
    update: updateFn ?? updateMock,
    _fromMock: fromMock,
    _whereMock: whereMock,
    _updateMock: updateFn ?? updateMock,
    _setMock: setMock,
    _whereUpdateMock: whereUpdateMock,
  } as any;
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
