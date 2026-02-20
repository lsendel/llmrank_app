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

const VALID_STATUSES: ActionItemStatus[] = [
  "pending",
  "in_progress",
  "fixed",
  "dismissed",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  if (!VALID_STATUSES.includes(body.status as ActionItemStatus)) {
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

    const updated = await actionItemQueries(db).updateStatus(
      id,
      body.status as ActionItemStatus,
    );
    return c.json({ data: updated });
  } catch (error) {
    return handleServiceError(c, error);
  }
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
