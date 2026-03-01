import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { handleServiceError } from "../services/errors";
import {
  actionItemQueries,
  projectQueries,
  type ActionItemStatus,
} from "@llm-boost/db";

export const actionItemRoutes = new Hono<AppEnv>();
actionItemRoutes.use("*", authMiddleware);
actionItemRoutes.use("*", async (c, next) => {
  // Legacy compatibility: `/api/action-plan` points to canonical `/api/action-items`.
  if (c.req.path.startsWith("/api/action-plan")) {
    c.header("Deprecation", "true");
    c.header("Link", '</api/action-items>; rel="successor-version"');
  }
  await next();
});

const VALID_STATUSES: ActionItemStatus[] = [
  "pending",
  "in_progress",
  "fixed",
  "dismissed",
];
const VALID_SEVERITIES = ["critical", "warning", "info"] as const;
const VALID_CATEGORIES = [
  "technical",
  "content",
  "ai_readiness",
  "performance",
  "schema",
  "llm_visibility",
] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseDueAt(raw: unknown): Date | null | "invalid" {
  if (raw === undefined) return null;
  if (raw === null) return null;
  if (typeof raw !== "string") return "invalid";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "invalid" : parsed;
}

function isValidStatus(status: unknown): status is ActionItemStatus {
  return VALID_STATUSES.includes(status as ActionItemStatus);
}

function normalizeOptionalAssignee(assigneeId: unknown): string | null {
  if (assigneeId === undefined || assigneeId === null) return null;
  if (typeof assigneeId !== "string") return null;
  const value = assigneeId.trim();
  return value.length > 0 ? value : null;
}

// POST /api/action-items — Create a manual action item for a project/issue
actionItemRoutes.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json<{
    projectId?: string;
    issueCode?: string;
    status?: ActionItemStatus;
    severity?: (typeof VALID_SEVERITIES)[number];
    category?: (typeof VALID_CATEGORIES)[number];
    scoreImpact?: number;
    title?: string;
    description?: string | null;
    assigneeId?: string | null;
    dueAt?: string | null;
  }>();

  if (!body.projectId || !UUID_RE.test(body.projectId)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId (uuid) is required",
        },
      },
      422,
    );
  }

  if (!body.issueCode || body.issueCode.trim().length === 0) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "issueCode is required",
        },
      },
      422,
    );
  }

  if (!body.title || body.title.trim().length === 0) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "title is required",
        },
      },
      422,
    );
  }

  if (body.status !== undefined && !isValidStatus(body.status)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        },
      },
      422,
    );
  }

  if (body.severity && !VALID_SEVERITIES.includes(body.severity)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(", ")}`,
        },
      },
      422,
    );
  }

  if (body.category && !VALID_CATEGORIES.includes(body.category)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
        },
      },
      422,
    );
  }

  const dueAt = parseDueAt(body.dueAt);
  if (dueAt === "invalid") {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "dueAt must be a valid ISO date string or null",
        },
      },
      422,
    );
  }

  const project = await projectQueries(db).getById(body.projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const normalizedIssueCode = body.issueCode.trim().toUpperCase();
  const existing = await actionItemQueries(db).getOpenByProjectIssueCode(
    body.projectId,
    normalizedIssueCode,
  );
  if (existing) {
    const nextStatus = isValidStatus(existing.status)
      ? existing.status
      : "pending";
    const updated = await actionItemQueries(db).update(existing.id, {
      status: body.status ?? nextStatus,
      assigneeId:
        body.assigneeId !== undefined
          ? normalizeOptionalAssignee(body.assigneeId)
          : existing.assigneeId,
      dueAt:
        body.dueAt !== undefined
          ? dueAt
          : ((existing as { dueAt?: Date | null }).dueAt ?? null),
    });
    return c.json({ data: updated }, 200);
  }

  const created = await actionItemQueries(db).create({
    projectId: body.projectId,
    issueCode: normalizedIssueCode,
    status: body.status ?? "pending",
    severity: body.severity ?? "warning",
    category: body.category ?? "technical",
    scoreImpact: Math.max(0, Number(body.scoreImpact ?? 0)),
    title: body.title.trim(),
    description:
      typeof body.description === "string" ? body.description.trim() : null,
    assigneeId: normalizeOptionalAssignee(body.assigneeId),
    dueAt,
  });

  return c.json({ data: created }, 201);
});

// GET /api/action-items?projectId=xxx — List action items for a project
actionItemRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");

  if (!projectId || !UUID_RE.test(projectId)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId query parameter required",
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

  const items = await actionItemQueries(db).listByProject(projectId);
  return c.json({ data: items });
});

// PATCH /api/action-items/:id/status — Update action item status
actionItemRoutes.patch("/:id/status", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  if (!UUID_RE.test(id)) {
    return c.json(
      {
        error: { code: "VALIDATION_ERROR", message: "Invalid action item ID" },
      },
      422,
    );
  }

  const body = await c.req.json<{ status: string }>();

  if (!isValidStatus(body.status)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        },
      },
      422,
    );
  }

  try {
    const existing = await actionItemQueries(db).getById(id);
    if (!existing) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Action item not found" } },
        404,
      );
    }

    // Verify the user owns the project
    const project = await projectQueries(db).getById(existing.projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Action item not found" } },
        404,
      );
    }

    const updated = await actionItemQueries(db).updateStatus(id, body.status);
    return c.json({ data: updated });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// PATCH /api/action-items/:id — Update action item fields
actionItemRoutes.patch("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  if (!UUID_RE.test(id)) {
    return c.json(
      {
        error: { code: "VALIDATION_ERROR", message: "Invalid action item ID" },
      },
      422,
    );
  }

  const body = await c.req.json<{
    status?: ActionItemStatus;
    assigneeId?: string | null;
    dueAt?: string | null;
    title?: string;
    description?: string | null;
  }>();

  if (body.status !== undefined && !isValidStatus(body.status)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        },
      },
      422,
    );
  }

  const dueAt = parseDueAt(body.dueAt);
  if (dueAt === "invalid") {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "dueAt must be a valid ISO date string or null",
        },
      },
      422,
    );
  }

  const existing = await actionItemQueries(db).getById(id);
  if (!existing) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Action item not found" } },
      404,
    );
  }

  const project = await projectQueries(db).getById(existing.projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Action item not found" } },
      404,
    );
  }

  const updated = await actionItemQueries(db).update(id, {
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.assigneeId !== undefined
      ? { assigneeId: normalizeOptionalAssignee(body.assigneeId) }
      : {}),
    ...(body.dueAt !== undefined ? { dueAt } : {}),
    ...(body.title !== undefined
      ? { title: body.title.trim() || existing.title }
      : {}),
    ...(body.description !== undefined
      ? {
          description:
            typeof body.description === "string"
              ? body.description.trim()
              : null,
        }
      : {}),
  });

  return c.json({ data: updated });
});

// GET /api/action-items/stats?projectId=xxx — Fix rate stats for a project
actionItemRoutes.get("/stats", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");

  if (!projectId || !UUID_RE.test(projectId)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId query parameter required",
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

  const stats = await actionItemQueries(db).getStats(projectId);
  return c.json({ data: stats });
});
