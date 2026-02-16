import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  scheduledVisibilityQueryQueries,
  projectQueries,
  userQueries,
  type Database,
} from "@llm-boost/db";
import { createScheduledVisibilityService } from "../services/scheduled-visibility-service";
import { handleServiceError } from "../services/errors";

export const visibilityScheduleRoutes = new Hono<AppEnv>();

visibilityScheduleRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// Helper — build service from context
// ---------------------------------------------------------------------------

function buildService(c: { get(key: "db"): Database }) {
  const db = c.get("db");
  const pq = projectQueries(db);
  const uq = userQueries(db);
  return createScheduledVisibilityService({
    schedules: scheduledVisibilityQueryQueries(db),
    projects: { getById: async (id: string) => (await pq.getById(id)) ?? null },
    users: { getById: async (id: string) => (await uq.getById(id)) ?? null },
  });
}

// ---------------------------------------------------------------------------
// POST / — Create a scheduled visibility query
// ---------------------------------------------------------------------------

visibilityScheduleRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    projectId: string;
    query: string;
    providers: string[];
    frequency: "hourly" | "daily" | "weekly";
  }>();

  if (
    !body.projectId ||
    !body.query ||
    !body.providers?.length ||
    !body.frequency
  ) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId, query, providers, and frequency are required",
        },
      },
      422,
    );
  }

  const service = buildService(c);

  try {
    const schedule = await service.create({
      userId,
      projectId: body.projectId,
      query: body.query,
      providers: body.providers,
      frequency: body.frequency,
    });
    return c.json({ data: schedule }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET / — List scheduled visibility queries for a project
// ---------------------------------------------------------------------------

visibilityScheduleRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");

  if (!projectId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId query parameter is required",
        },
      },
      422,
    );
  }

  const service = buildService(c);

  try {
    const schedules = await service.list(userId, projectId);
    return c.json({ data: schedules });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// PATCH /:id — Update a scheduled visibility query
// ---------------------------------------------------------------------------

visibilityScheduleRoutes.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const scheduleId = c.req.param("id");
  const body = await c.req.json<{
    query?: string;
    providers?: string[];
    frequency?: "hourly" | "daily" | "weekly";
    enabled?: boolean;
  }>();

  const service = buildService(c);

  try {
    const updated = await service.update(userId, scheduleId, body);
    return c.json({ data: updated });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — Delete a scheduled visibility query
// ---------------------------------------------------------------------------

visibilityScheduleRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const scheduleId = c.req.param("id");
  const service = buildService(c);

  try {
    await service.delete(userId, scheduleId);
    return c.json({ data: { success: true } });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
