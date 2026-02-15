import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildUser } from "../helpers/factories";

// ---------------------------------------------------------------------------
// Mock auth middleware to bypass JWT verification.
// Admin middleware (adminMiddleware) is kept real to test its 403 behavior.
// ---------------------------------------------------------------------------

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
}));

// ---------------------------------------------------------------------------
// Mock the @llm-boost/db userQueries used by the real admin middleware
// ---------------------------------------------------------------------------

const mockUserGetById = vi.fn().mockResolvedValue(null);

vi.mock("@llm-boost/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@llm-boost/db")>();
  return {
    ...orig,
    userQueries: () => ({
      getById: mockUserGetById,
      getByClerkId: vi.fn().mockResolvedValue(null),
      upsertFromClerk: vi.fn().mockResolvedValue(buildUser()),
    }),
    createDb: orig.createDb,
  };
});

// Mock the admin repository
const mockAdminRepo = {
  getStats: vi.fn().mockResolvedValue({
    totalUsers: 100,
    totalProjects: 250,
    totalCrawls: 1000,
  }),
  getCustomers: vi.fn().mockResolvedValue([]),
  getCustomerDetail: vi.fn().mockResolvedValue(null),
  getIngestDetails: vi.fn().mockResolvedValue([]),
  retryCrawlJob: vi.fn().mockResolvedValue(undefined),
  replayOutboxEvent: vi.fn().mockResolvedValue(undefined),
  cancelCrawlJob: vi.fn().mockResolvedValue(undefined),
  recordAction: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../../repositories", () => ({
  createAdminRepository: () => mockAdminRepo,
}));

// Mock notification and monitoring services used by metrics endpoint
vi.mock("../../services/notification-service", () => ({
  createNotificationService: () => ({
    processQueue: vi.fn().mockResolvedValue(undefined),
    sendCrawlComplete: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../services/monitoring-service", () => ({
  createMonitoringService: () => ({
    checkSystemHealth: vi.fn().mockResolvedValue(undefined),
    getSystemMetrics: vi.fn().mockResolvedValue({
      activeCrawls: 2,
      queueDepth: 5,
      errorRate: 0.01,
    }),
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Admin Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Admin middleware enforcement
  // -----------------------------------------------------------------------

  it("returns 403 when non-admin user accesses admin routes", async () => {
    mockUserGetById.mockResolvedValue(
      buildUser({ id: "test-user-id", isAdmin: false }),
    );

    const res = await request("/api/admin/stats");
    expect(res.status).toBe(403);

    const body: any = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toContain("Admin");
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/stats (admin user)
  // -----------------------------------------------------------------------

  it("returns 200 with stats when user is admin", async () => {
    mockUserGetById.mockResolvedValue(
      buildUser({ id: "test-user-id", isAdmin: true }),
    );

    const res = await request("/api/admin/stats");
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.data).toHaveProperty("totalUsers");
    expect(body.data).toHaveProperty("totalProjects");
    expect(body.data).toHaveProperty("totalCrawls");
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/customers
  // -----------------------------------------------------------------------

  it("returns customer list for admin users", async () => {
    mockUserGetById.mockResolvedValue(
      buildUser({ id: "test-user-id", isAdmin: true }),
    );
    mockAdminRepo.getCustomers.mockResolvedValue({
      data: [{ id: "u-1", email: "a@b.com" }],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });

    const res = await request("/api/admin/customers");
    expect(res.status).toBe(200);
  });

  it("passes search query parameter to getCustomers", async () => {
    mockUserGetById.mockResolvedValue(
      buildUser({ id: "test-user-id", isAdmin: true }),
    );
    mockAdminRepo.getCustomers.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
    });

    const res = await request(
      "/api/admin/customers?page=2&limit=10&search=alice",
    );
    expect(res.status).toBe(200);
    expect(mockAdminRepo.getCustomers).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      search: "alice",
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/customers/:id
  // -----------------------------------------------------------------------

  describe("GET /api/admin/customers/:id", () => {
    it("returns 200 with customer detail", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", isAdmin: true }),
      );
      mockAdminRepo.getCustomerDetail.mockResolvedValue({
        id: "u-1",
        email: "alice@example.com",
        plan: "pro",
      });

      const res = await request("/api/admin/customers/u-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id", "u-1");
      expect(body.data).toHaveProperty("email", "alice@example.com");
    });

    it("returns 404 when customer not found", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", isAdmin: true }),
      );
      mockAdminRepo.getCustomerDetail.mockResolvedValue(null);

      const res = await request("/api/admin/customers/nonexistent");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/metrics
  // -----------------------------------------------------------------------

  describe("GET /api/admin/metrics", () => {
    it("returns 200 with system metrics", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", isAdmin: true }),
      );

      const res = await request("/api/admin/metrics");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("activeCrawls");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/ingest
  // -----------------------------------------------------------------------

  describe("GET /api/admin/ingest", () => {
    it("returns 200 with ingest details", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", isAdmin: true }),
      );
      mockAdminRepo.getIngestDetails.mockResolvedValue({
        recentJobs: [],
        outboxPending: 0,
      });

      const res = await request("/api/admin/ingest");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/admin/ingest/jobs/:id/retry
  // -----------------------------------------------------------------------

  describe("POST /api/admin/ingest/jobs/:id/retry", () => {
    it("returns 200 when retrying a crawl job", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", isAdmin: true }),
      );
      mockAdminRepo.retryCrawlJob.mockResolvedValue({
        id: "job-1",
        status: "queued",
      });

      const res = await request("/api/admin/ingest/jobs/job-1/retry", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id", "job-1");
      expect(mockAdminRepo.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "retry_crawl_job",
          targetId: "job-1",
        }),
      );
    });

    it("returns 404 when crawl job not found for retry", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", isAdmin: true }),
      );
      mockAdminRepo.retryCrawlJob.mockResolvedValue(null);

      const res = await request("/api/admin/ingest/jobs/nonexistent/retry", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/admin/ingest/jobs/:id/cancel
  // -----------------------------------------------------------------------

  describe("POST /api/admin/ingest/jobs/:id/cancel", () => {
    it("returns 200 when cancelling a crawl job", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", isAdmin: true }),
      );
      mockAdminRepo.cancelCrawlJob.mockResolvedValue({
        id: "job-1",
        status: "failed",
      });

      const res = await request("/api/admin/ingest/jobs/job-1/cancel", {
        method: "POST",
        json: { reason: "Testing cancellation" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id", "job-1");
      expect(mockAdminRepo.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "cancel_crawl_job",
          reason: "Testing cancellation",
        }),
      );
    });

    it("uses default reason when none provided", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", isAdmin: true }),
      );
      mockAdminRepo.cancelCrawlJob.mockResolvedValue({
        id: "job-1",
        status: "failed",
      });

      const res = await request("/api/admin/ingest/jobs/job-1/cancel", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(200);
    });

    it("returns 404 when crawl job not found for cancel", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", isAdmin: true }),
      );
      mockAdminRepo.cancelCrawlJob.mockResolvedValue(null);

      const res = await request("/api/admin/ingest/jobs/nonexistent/cancel", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/admin/ingest/outbox/:id/replay
  // -----------------------------------------------------------------------

  describe("POST /api/admin/ingest/outbox/:id/replay", () => {
    it("returns 200 when replaying an outbox event", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", isAdmin: true }),
      );
      mockAdminRepo.replayOutboxEvent.mockResolvedValue({
        id: "evt-1",
        status: "pending",
      });

      const res = await request("/api/admin/ingest/outbox/evt-1/replay", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id", "evt-1");
      expect(mockAdminRepo.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "replay_outbox_event",
          targetId: "evt-1",
        }),
      );
    });

    it("returns 404 when outbox event not found", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", isAdmin: true }),
      );
      mockAdminRepo.replayOutboxEvent.mockResolvedValue(null);

      const res = await request("/api/admin/ingest/outbox/nonexistent/replay", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});
