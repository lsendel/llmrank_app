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
import {
  reportScheduleQueries,
  projectQueries,
  userQueries,
} from "@llm-boost/db";

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

// ---------------------------------------------------------------------------
// Report Schedules CRUD — Pro+ only
// ---------------------------------------------------------------------------

// POST /api/reports/schedules — Create a report schedule
reportRoutes.post("/schedules", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = await c.req.json<{
    projectId?: string;
    format?: string;
    type?: string;
    recipientEmail?: string;
  }>();

  if (!body.projectId || !body.recipientEmail) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId and recipientEmail are required",
        },
      },
      422,
    );
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.recipientEmail)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "recipientEmail must be a valid email address",
        },
      },
      422,
    );
  }

  // Validate format and type
  const VALID_FORMATS = ["pdf", "docx"] as const;
  const VALID_TYPES = ["summary", "detailed"] as const;
  const format = body.format ?? "pdf";
  const type = body.type ?? "summary";

  if (!VALID_FORMATS.includes(format as (typeof VALID_FORMATS)[number])) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `format must be one of: ${VALID_FORMATS.join(", ")}`,
        },
      },
      422,
    );
  }
  if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `type must be one of: ${VALID_TYPES.join(", ")}`,
        },
      },
      422,
    );
  }

  // Plan gate: Pro+ only
  const user = await userQueries(db).getById(userId);
  if (!user || (user.plan !== "pro" && user.plan !== "agency")) {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: "Scheduled reports are available on Pro plans and above.",
        },
      },
      403,
    );
  }

  const project = await projectQueries(db).getById(body.projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  try {
    const schedule = await reportScheduleQueries(db).create({
      projectId: body.projectId,
      format: format as "pdf" | "docx",
      type: type as "summary" | "detailed",
      recipientEmail: body.recipientEmail,
    });

    return c.json({ data: schedule }, 201);
  } catch (err) {
    console.error(`[schedules] Failed to create schedule:`, err);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create report schedule",
        },
      },
      500,
    );
  }
});

// GET /api/reports/schedules?projectId=xxx — List schedules for a project
reportRoutes.get("/schedules", async (c) => {
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

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  try {
    const schedules = await reportScheduleQueries(db).listByProject(projectId);
    return c.json({ data: schedules });
  } catch (err) {
    console.error(`[schedules] Failed to list schedules:`, err);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to list report schedules",
        },
      },
      500,
    );
  }
});

// PATCH /api/reports/schedules/:id — Update a schedule
reportRoutes.patch("/schedules/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const scheduleId = c.req.param("id");

  const body = await c.req.json<{
    format?: string;
    type?: string;
    recipientEmail?: string;
    enabled?: boolean;
  }>();

  const schedule = await reportScheduleQueries(db).getById(scheduleId);
  if (!schedule) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Schedule not found" } },
      404,
    );
  }

  const project = await projectQueries(db).getById(schedule.projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Schedule not found" } },
      404,
    );
  }

  // Validate format/type if provided
  if (body.format && !["pdf", "docx"].includes(body.format)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "format must be one of: pdf, docx",
        },
      },
      422,
    );
  }
  if (body.type && !["summary", "detailed"].includes(body.type)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "type must be one of: summary, detailed",
        },
      },
      422,
    );
  }

  try {
    const updated = await reportScheduleQueries(db).update(scheduleId, {
      ...(body.format && { format: body.format as "pdf" | "docx" }),
      ...(body.type && { type: body.type as "summary" | "detailed" }),
      ...(body.recipientEmail && { recipientEmail: body.recipientEmail }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
    });

    return c.json({ data: updated });
  } catch (err) {
    console.error(`[schedules] Failed to update schedule ${scheduleId}:`, err);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update report schedule",
        },
      },
      500,
    );
  }
});

// DELETE /api/reports/schedules/:id — Delete a schedule
reportRoutes.delete("/schedules/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const scheduleId = c.req.param("id");

  const schedule = await reportScheduleQueries(db).getById(scheduleId);
  if (!schedule) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Schedule not found" } },
      404,
    );
  }

  const project = await projectQueries(db).getById(schedule.projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Schedule not found" } },
      404,
    );
  }

  try {
    await reportScheduleQueries(db).delete(scheduleId);
    return c.json({ data: { deleted: true } });
  } catch (err) {
    console.error(`[schedules] Failed to delete schedule ${scheduleId}:`, err);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to delete report schedule",
        },
      },
      500,
    );
  }
});
