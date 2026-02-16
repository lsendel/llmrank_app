import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { GenerateReportSchema } from "@llm-boost/shared";
import {
  createReportRepository,
  createProjectRepository,
  createUserRepository,
  createCrawlRepository,
} from "../repositories";
import { createReportService } from "../services/report-service";
import { handleServiceError } from "../services/errors";

export const reportRoutes = new Hono<AppEnv>();

reportRoutes.use("*", authMiddleware);

// POST /api/reports/generate — Request report generation
reportRoutes.post("/generate", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json();

  const parsed = GenerateReportSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid report request",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  const service = createReportService({
    reports: createReportRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  try {
    const report = await service.generate(userId, parsed.data, {
      reportServiceUrl: c.env.REPORT_SERVICE_URL,
      sharedSecret: c.env.SHARED_SECRET,
    });
    return c.json({ data: report }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /api/reports?projectId=xxx — List reports for a project
reportRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");

  if (!projectId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId is required",
        },
      },
      422,
    );
  }

  const service = createReportService({
    reports: createReportRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  try {
    const reports = await service.list(userId, projectId);
    return c.json({ data: reports });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /api/reports/:id — Get report status
reportRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const reportId = c.req.param("id");

  const service = createReportService({
    reports: createReportRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  try {
    const report = await service.getStatus(userId, reportId);
    return c.json({ data: report });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /api/reports/:id/download — Get download URL
reportRoutes.get("/:id/download", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const reportId = c.req.param("id");

  const repo = createReportRepository(db);
  const report = await repo.getById(reportId);

  if (!report || report.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Report not found" } },
      404,
    );
  }

  if (report.status !== "complete" || !report.r2Key) {
    console.log(
      `Report ${reportId} not ready: status=${report.status}, r2Key=${report.r2Key}`,
    );
    return c.json(
      {
        error: {
          code: "NOT_READY",
          message: "Report is not ready for download",
        },
      },
      409,
    );
  }

  console.log(`Downloading report ${reportId} from R2 key: ${report.r2Key}`);
  // Get the object from R2 and stream it
  const object = await c.env.R2.get(report.r2Key);
  if (!object) {
    console.error(
      `Report ${reportId} file not found in R2 key: ${report.r2Key}`,
    );
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Report file not found in storage",
        },
      },
      404,
    );
  }

  const ext = report.format === "pdf" ? "pdf" : "docx";
  const contentType =
    report.format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const filename = `ai-readiness-report-${report.type}.${ext}`;

  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(report.fileSize ?? 0),
    },
  });
});

// DELETE /api/reports/:id — Delete a report
reportRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const reportId = c.req.param("id");

  const service = createReportService({
    reports: createReportRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  try {
    await service.deleteReport(userId, reportId, c.env.R2);
    return c.json({ data: { deleted: true } });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
