import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { ServiceError } from "../../services/errors";

// ---------------------------------------------------------------------------
// Mock auth middleware to bypass JWT verification
// ---------------------------------------------------------------------------

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
}));

// ---------------------------------------------------------------------------
// Mock the repositories and service layer
// ---------------------------------------------------------------------------

const mockLogRepo = {
  create: vi.fn().mockResolvedValue({ id: "log-1" }),
  listByProject: vi.fn().mockResolvedValue([]),
  getById: vi.fn().mockResolvedValue(null),
};

const mockProjectRepo = {
  listByUser: vi.fn().mockResolvedValue([]),
  getById: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({ id: "proj-1" }),
  update: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  getDueForCrawl: vi.fn().mockResolvedValue([]),
  updateNextCrawl: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../../repositories", () => ({
  createLogRepository: () => mockLogRepo,
  createProjectRepository: () => mockProjectRepo,
  createUserRepository: () => ({}),
  createCrawlRepository: () => ({}),
  createScoreRepository: () => ({}),
  createPageRepository: () => ({}),
}));

// ---------------------------------------------------------------------------
// Mock the log service — controls return values per test
// ---------------------------------------------------------------------------

const mockLogServiceUpload = vi
  .fn()
  .mockResolvedValue({ id: "log-1", summary: {} });
const mockLogServiceList = vi.fn().mockResolvedValue([]);
const mockLogServiceGet = vi.fn().mockResolvedValue(null);

vi.mock("../../services/log-service", () => ({
  createLogService: () => ({
    upload: mockLogServiceUpload,
    list: mockLogServiceList,
    get: mockLogServiceGet,
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Log Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // POST /api/logs/:projectId/upload
  // -----------------------------------------------------------------------

  describe("POST /api/logs/:projectId/upload", () => {
    it("returns 200 with upload result on success", async () => {
      mockLogServiceUpload.mockResolvedValue({
        id: "log-1",
        summary: { totalRequests: 100, crawlerRequests: 20, uniqueIPs: 10 },
      });

      const res = await request("/api/logs/proj-1/upload", {
        method: "POST",
        json: {
          filename: "access.log",
          content:
            '127.0.0.1 - - [01/Jan/2024:00:00:00 +0000] "GET / HTTP/1.1" 200 1234',
        },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id", "log-1");
      expect(body.data).toHaveProperty("summary");
    });

    it("returns 422 when filename is missing", async () => {
      mockLogServiceUpload.mockRejectedValue(
        new ServiceError(
          "VALIDATION_ERROR",
          422,
          "filename and content required",
        ),
      );

      const res = await request("/api/logs/proj-1/upload", {
        method: "POST",
        json: { content: "some log content" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 when content is missing", async () => {
      mockLogServiceUpload.mockRejectedValue(
        new ServiceError(
          "VALIDATION_ERROR",
          422,
          "filename and content required",
        ),
      );

      const res = await request("/api/logs/proj-1/upload", {
        method: "POST",
        json: { filename: "access.log" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 404 when project not owned by user", async () => {
      mockLogServiceUpload.mockRejectedValue(
        new ServiceError("NOT_FOUND", 404, "Not found"),
      );

      const res = await request("/api/logs/proj-other/upload", {
        method: "POST",
        json: { filename: "access.log", content: "log data" },
      });
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 422 when no valid log entries found", async () => {
      mockLogServiceUpload.mockRejectedValue(
        new ServiceError("VALIDATION_ERROR", 422, "No valid log entries found"),
      );

      const res = await request("/api/logs/proj-1/upload", {
        method: "POST",
        json: { filename: "garbage.log", content: "this is not a log" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("No valid log entries");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/logs/:projectId
  // -----------------------------------------------------------------------

  describe("GET /api/logs/:projectId", () => {
    it("returns 200 with list of log uploads", async () => {
      mockLogServiceList.mockResolvedValue([
        { id: "log-1", filename: "access.log", totalRequests: 100 },
        { id: "log-2", filename: "bot.log", totalRequests: 50 },
      ]);

      const res = await request("/api/logs/proj-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBe(2);
    });

    it("returns 200 with empty array when no logs", async () => {
      mockLogServiceList.mockResolvedValue([]);

      const res = await request("/api/logs/proj-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toEqual([]);
    });

    it("returns 404 when project not owned by user", async () => {
      mockLogServiceList.mockRejectedValue(
        new ServiceError("NOT_FOUND", 404, "Not found"),
      );

      const res = await request("/api/logs/proj-other");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/logs/detail/:id
  // -----------------------------------------------------------------------

  describe("GET /api/logs/detail/:id", () => {
    it("returns 200 with log detail", async () => {
      mockLogServiceGet.mockResolvedValue({
        id: "log-1",
        filename: "access.log",
        totalRequests: 100,
        crawlerRequests: 20,
        uniqueIPs: 10,
        summary: { totalRequests: 100 },
      });

      const res = await request("/api/logs/detail/log-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id", "log-1");
      expect(body.data).toHaveProperty("summary");
    });

    it("returns 404 when log upload not found", async () => {
      mockLogServiceGet.mockRejectedValue(
        new ServiceError("NOT_FOUND", 404, "Log upload not found"),
      );

      const res = await request("/api/logs/detail/nonexistent");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 when log belongs to different user", async () => {
      mockLogServiceGet.mockRejectedValue(
        new ServiceError("NOT_FOUND", 404, "Not found"),
      );

      const res = await request("/api/logs/detail/log-1");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});
