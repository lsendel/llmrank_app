import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { createLogRepository, createProjectRepository } from "../repositories";
import { createLogService } from "../services/log-service";
import { handleServiceError } from "../services/errors";

export const logRoutes = new Hono<AppEnv>();

// ─── POST /:projectId/upload — Upload + analyze server log file ────

logRoutes.post("/:projectId/upload", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const body = await c.req.json<{ filename: string; content: string }>();
  const service = createLogService({
    logs: createLogRepository(db),
    projects: createProjectRepository(db),
  });

  try {
    const data = await service.upload(userId, projectId, body);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── GET /:projectId — List log uploads for project ────────────────

logRoutes.get("/:projectId", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const service = createLogService({
    logs: createLogRepository(db),
    projects: createProjectRepository(db),
  });

  try {
    const data = await service.list(userId, projectId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── GET /:projectId/crawler-timeline — AI crawler activity timeline ─

logRoutes.get("/:projectId/crawler-timeline", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const service = createLogService({
    logs: createLogRepository(db),
    projects: createProjectRepository(db),
  });

  try {
    const data = await service.getCrawlerTimeline(userId, projectId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── GET /detail/:id — Get a specific log upload with summary ──────

logRoutes.get("/detail/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const logId = c.req.param("id");
  const service = createLogService({
    logs: createLogRepository(db),
    projects: createProjectRepository(db),
  });

  try {
    const data = await service.get(userId, logId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
