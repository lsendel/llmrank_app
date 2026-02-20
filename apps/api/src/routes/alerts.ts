import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { alertQueries, projectQueries } from "@llm-boost/db";

export const alertRoutes = new Hono<AppEnv>();
alertRoutes.use("*", authMiddleware);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/alerts?projectId=xxx — List unacknowledged alerts for a project
alertRoutes.get("/", async (c) => {
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

  const items = await alertQueries(db).listUnacknowledged(projectId);
  return c.json({ data: items });
});

// POST /api/alerts/:id/acknowledge — Acknowledge a single alert
alertRoutes.post("/:id/acknowledge", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  if (!UUID_RE.test(id)) {
    return c.json(
      {
        error: { code: "VALIDATION_ERROR", message: "Invalid alert ID" },
      },
      422,
    );
  }

  const updated = await alertQueries(db).acknowledge(id);
  if (!updated) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Alert not found" } },
      404,
    );
  }

  // Verify the user owns the project
  const project = await projectQueries(db).getById(updated.projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Alert not found" } },
      404,
    );
  }

  return c.json({ data: updated });
});

// POST /api/alerts/acknowledge-all?projectId=xxx — Acknowledge all alerts for a project
alertRoutes.post("/acknowledge-all", async (c) => {
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

  await alertQueries(db).acknowledgeAll(projectId);
  return c.json({ data: { success: true } });
});
