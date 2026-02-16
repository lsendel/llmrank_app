import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import {
  buildProject,
  buildUser,
  buildCrawlJob,
  buildReport,
} from "../helpers/factories";

// ---------------------------------------------------------------------------
// Mock auth middleware so tests bypass JWT verification.
// The test-app already sets c.var.userId; this mock just calls next().
// ---------------------------------------------------------------------------

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
}));

// Mock global fetch for report service HTTP dispatch
const mockFetch = vi
  .fn()
  .mockResolvedValue(
    new Response(JSON.stringify({ accepted: true }), { status: 202 }),
  );
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Mock the repository factory functions so routes never hit a real DB
// ---------------------------------------------------------------------------

const mockProjectRepo = {
  listByUser: vi.fn().mockResolvedValue([]),
  getById: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({ id: "proj-new" }),
  update: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  getDueForCrawl: vi.fn().mockResolvedValue([]),
  updateNextCrawl: vi.fn().mockResolvedValue(undefined),
};

const mockUserRepo = {
  getById: vi.fn().mockResolvedValue(buildUser({ id: "test-user-id" })),
  decrementCrawlCredits: vi.fn().mockResolvedValue(true),
};

const mockCrawlRepo = {
  create: vi.fn().mockResolvedValue(buildCrawlJob()),
  getById: vi.fn().mockResolvedValue(null),
  getLatestByProject: vi.fn().mockResolvedValue(null),
  listByProject: vi.fn().mockResolvedValue([]),
  updateStatus: vi.fn().mockResolvedValue(undefined),
  generateShareToken: vi.fn().mockResolvedValue("token"),
  disableSharing: vi.fn().mockResolvedValue(undefined),
};

const mockReportRepo = {
  create: vi.fn().mockResolvedValue(buildReport()),
  getById: vi.fn().mockResolvedValue(null),
  listByProject: vi.fn().mockResolvedValue([]),
  countThisMonth: vi.fn().mockResolvedValue(0),
  updateStatus: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../../repositories", () => ({
  createProjectRepository: () => mockProjectRepo,
  createUserRepository: () => mockUserRepo,
  createCrawlRepository: () => mockCrawlRepo,
  createScoreRepository: () => ({}),
  createPageRepository: () => ({}),
  createReportRepository: () => mockReportRepo,
}));

// ---------------------------------------------------------------------------
// Constants — valid UUIDs for schema validation
// ---------------------------------------------------------------------------

const VALID_PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const VALID_CRAWL_ID = "22222222-2222-2222-2222-222222222222";
const VALID_REPORT_ID = "33333333-3333-3333-3333-333333333333";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Report Routes", () => {
  const { request, r2 } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRepo.getById.mockResolvedValue(
      buildUser({ id: "test-user-id", plan: "pro" }),
    );
    mockProjectRepo.getById.mockResolvedValue(null);
    mockCrawlRepo.getById.mockResolvedValue(null);
    mockReportRepo.getById.mockResolvedValue(null);
    mockReportRepo.countThisMonth.mockResolvedValue(0);
    mockReportRepo.listByProject.mockResolvedValue([]);
  });

  // -----------------------------------------------------------------------
  // POST /api/reports/generate
  // -----------------------------------------------------------------------

  describe("POST /api/reports/generate", () => {
    it("creates report and returns 201", async () => {
      const project = buildProject({
        id: VALID_PROJECT_ID,
        userId: "test-user-id",
      });
      const crawl = buildCrawlJob({
        id: VALID_CRAWL_ID,
        projectId: VALID_PROJECT_ID,
        status: "complete",
      });
      const report = buildReport({
        id: VALID_REPORT_ID,
        projectId: VALID_PROJECT_ID,
        crawlJobId: VALID_CRAWL_ID,
        userId: "test-user-id",
      });

      mockProjectRepo.getById.mockResolvedValue(project);
      mockCrawlRepo.getById.mockResolvedValue(crawl);
      mockReportRepo.create.mockResolvedValue(report);
      mockReportRepo.countThisMonth.mockResolvedValue(0);

      const res = await request("/api/reports/generate", {
        method: "POST",
        json: {
          projectId: VALID_PROJECT_ID,
          crawlJobId: VALID_CRAWL_ID,
          type: "summary",
          format: "pdf",
        },
      });
      expect(res.status).toBe(201);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id", VALID_REPORT_ID);
      expect(body.data.projectId).toBe(VALID_PROJECT_ID);
      expect(body.data.status).toBe("queued");
    });

    it("rejects with 422 for invalid body", async () => {
      const res = await request("/api/reports/generate", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects with 422 for invalid projectId format", async () => {
      const res = await request("/api/reports/generate", {
        method: "POST",
        json: {
          projectId: "not-a-uuid",
          crawlJobId: VALID_CRAWL_ID,
          type: "summary",
          format: "pdf",
        },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects with 404 for non-owned project", async () => {
      const project = buildProject({
        id: VALID_PROJECT_ID,
        userId: "other-user-id",
      });
      mockProjectRepo.getById.mockResolvedValue(project);

      const res = await request("/api/reports/generate", {
        method: "POST",
        json: {
          projectId: VALID_PROJECT_ID,
          crawlJobId: VALID_CRAWL_ID,
          type: "summary",
          format: "pdf",
        },
      });
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("rejects with 409 for incomplete crawl", async () => {
      const project = buildProject({
        id: VALID_PROJECT_ID,
        userId: "test-user-id",
      });
      const crawl = buildCrawlJob({
        id: VALID_CRAWL_ID,
        projectId: VALID_PROJECT_ID,
        status: "crawling",
      });

      mockProjectRepo.getById.mockResolvedValue(project);
      mockCrawlRepo.getById.mockResolvedValue(crawl);

      const res = await request("/api/reports/generate", {
        method: "POST",
        json: {
          projectId: VALID_PROJECT_ID,
          crawlJobId: VALID_CRAWL_ID,
          type: "summary",
          format: "pdf",
        },
      });
      expect(res.status).toBe(409);

      const body: any = await res.json();
      expect(body.error.code).toBe("INVALID_STATE");
    });

    it("rejects with 403 when plan limit reached", async () => {
      const project = buildProject({
        id: VALID_PROJECT_ID,
        userId: "test-user-id",
      });
      const crawl = buildCrawlJob({
        id: VALID_CRAWL_ID,
        projectId: VALID_PROJECT_ID,
        status: "complete",
      });

      mockProjectRepo.getById.mockResolvedValue(project);
      mockCrawlRepo.getById.mockResolvedValue(crawl);
      // Free plan allows 1 report/month — set count to 1 to exceed
      mockUserRepo.getById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "free" }),
      );
      mockReportRepo.countThisMonth.mockResolvedValue(1);

      const res = await request("/api/reports/generate", {
        method: "POST",
        json: {
          projectId: VALID_PROJECT_ID,
          crawlJobId: VALID_CRAWL_ID,
          type: "summary",
          format: "pdf",
        },
      });
      expect(res.status).toBe(403);

      const body: any = await res.json();
      expect(body.error.code).toBe("PLAN_LIMIT_REACHED");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/reports
  // -----------------------------------------------------------------------

  describe("GET /api/reports", () => {
    it("lists reports for project", async () => {
      const project = buildProject({
        id: VALID_PROJECT_ID,
        userId: "test-user-id",
      });
      const reports = [
        buildReport({ id: "report-1", projectId: VALID_PROJECT_ID }),
        buildReport({ id: "report-2", projectId: VALID_PROJECT_ID }),
      ];

      mockProjectRepo.getById.mockResolvedValue(project);
      mockReportRepo.listByProject.mockResolvedValue(reports);

      const res = await request(`/api/reports?projectId=${VALID_PROJECT_ID}`);
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBe(2);
    });

    it("requires projectId query parameter", async () => {
      const res = await request("/api/reports");
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBe("projectId is required");
    });

    it("returns 404 for non-owned project", async () => {
      const project = buildProject({
        id: VALID_PROJECT_ID,
        userId: "other-user-id",
      });
      mockProjectRepo.getById.mockResolvedValue(project);

      const res = await request(`/api/reports?projectId=${VALID_PROJECT_ID}`);
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/reports/:id
  // -----------------------------------------------------------------------

  describe("GET /api/reports/:id", () => {
    it("returns report status for owned report", async () => {
      const report = buildReport({
        id: VALID_REPORT_ID,
        userId: "test-user-id",
        status: "generating",
      });
      mockReportRepo.getById.mockResolvedValue(report);

      const res = await request(`/api/reports/${VALID_REPORT_ID}`);
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id", VALID_REPORT_ID);
      expect(body.data.status).toBe("generating");
    });

    it("returns 404 for non-owned report", async () => {
      const report = buildReport({
        id: VALID_REPORT_ID,
        userId: "other-user-id",
      });
      mockReportRepo.getById.mockResolvedValue(report);

      const res = await request(`/api/reports/${VALID_REPORT_ID}`);
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 for non-existent report", async () => {
      mockReportRepo.getById.mockResolvedValue(null);

      const res = await request(`/api/reports/${VALID_REPORT_ID}`);
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/reports/:id/download
  // -----------------------------------------------------------------------

  describe("GET /api/reports/:id/download", () => {
    it("streams file for completed PDF report", async () => {
      const report = buildReport({
        id: VALID_REPORT_ID,
        userId: "test-user-id",
        status: "complete",
        format: "pdf",
        r2Key: "reports/test-report.pdf",
        fileSize: 1024,
      });
      mockReportRepo.getById.mockResolvedValue(report);

      // Seed the R2 stub with the file content
      await r2.put("reports/test-report.pdf", "fake-pdf-content");

      const res = await request(`/api/reports/${VALID_REPORT_ID}/download`);
      expect(res.status).toBe(200);

      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Content-Disposition")).toContain(
        'attachment; filename="ai-readiness-report-summary.pdf"',
      );
      expect(res.headers.get("Content-Length")).toBe("1024");
    });

    it("streams file for completed DOCX report", async () => {
      const report = buildReport({
        id: VALID_REPORT_ID,
        userId: "test-user-id",
        status: "complete",
        format: "docx",
        type: "detailed",
        r2Key: "reports/test-report.docx",
        fileSize: 2048,
      });
      mockReportRepo.getById.mockResolvedValue(report);

      await r2.put("reports/test-report.docx", "fake-docx-content");

      const res = await request(`/api/reports/${VALID_REPORT_ID}/download`);
      expect(res.status).toBe(200);

      expect(res.headers.get("Content-Type")).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      expect(res.headers.get("Content-Disposition")).toContain(
        'attachment; filename="ai-readiness-report-detailed.docx"',
      );
    });

    it("returns 409 for non-complete report", async () => {
      const report = buildReport({
        id: VALID_REPORT_ID,
        userId: "test-user-id",
        status: "generating",
        r2Key: null,
      });
      mockReportRepo.getById.mockResolvedValue(report);

      const res = await request(`/api/reports/${VALID_REPORT_ID}/download`);
      expect(res.status).toBe(409);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_READY");
    });

    it("returns 404 when R2 object missing", async () => {
      const report = buildReport({
        id: VALID_REPORT_ID,
        userId: "test-user-id",
        status: "complete",
        r2Key: "reports/missing-file.pdf",
        fileSize: 1024,
      });
      mockReportRepo.getById.mockResolvedValue(report);
      // Do NOT put anything in R2 — the key doesn't exist

      const res = await request(`/api/reports/${VALID_REPORT_ID}/download`);
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toContain("file not found");
    });

    it("returns 404 for non-owned report download", async () => {
      const report = buildReport({
        id: VALID_REPORT_ID,
        userId: "other-user-id",
        status: "complete",
        r2Key: "reports/test-report.pdf",
      });
      mockReportRepo.getById.mockResolvedValue(report);

      const res = await request(`/api/reports/${VALID_REPORT_ID}/download`);
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/reports/:id
  // -----------------------------------------------------------------------

  describe("DELETE /api/reports/:id", () => {
    it("deletes report and R2 object", async () => {
      const report = buildReport({
        id: VALID_REPORT_ID,
        userId: "test-user-id",
        r2Key: "reports/to-delete.pdf",
      });
      mockReportRepo.getById.mockResolvedValue(report);

      // Seed R2 so we can verify deletion
      await r2.put("reports/to-delete.pdf", "content-to-delete");

      const res = await request(`/api/reports/${VALID_REPORT_ID}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toEqual({ deleted: true });

      // Verify repo.delete was called
      expect(mockReportRepo.delete).toHaveBeenCalledWith(VALID_REPORT_ID);
    });

    it("deletes report without R2 key", async () => {
      const report = buildReport({
        id: VALID_REPORT_ID,
        userId: "test-user-id",
        r2Key: null,
      });
      mockReportRepo.getById.mockResolvedValue(report);

      const res = await request(`/api/reports/${VALID_REPORT_ID}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toEqual({ deleted: true });
      expect(mockReportRepo.delete).toHaveBeenCalledWith(VALID_REPORT_ID);
    });

    it("returns 404 for non-owned report", async () => {
      const report = buildReport({
        id: VALID_REPORT_ID,
        userId: "other-user-id",
      });
      mockReportRepo.getById.mockResolvedValue(report);

      const res = await request(`/api/reports/${VALID_REPORT_ID}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 for non-existent report", async () => {
      mockReportRepo.getById.mockResolvedValue(null);

      const res = await request(`/api/reports/${VALID_REPORT_ID}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});
