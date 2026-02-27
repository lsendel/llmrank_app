import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { handleServiceError } from "../services/errors";
import {
  competitorMonitoringScheduleQueries,
  userQueries,
  projectQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS, resolveEffectivePlan } from "@llm-boost/shared";

export const competitorWatchlistRoutes = new Hono<AppEnv>();
competitorWatchlistRoutes.use("*", authMiddleware);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/competitors/watchlist — Create a watchlist query
competitorWatchlistRoutes.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = await c.req.json<{
    projectId?: string;
    query?: string;
    providers?: string[];
    frequency?: string;
  }>();

  if (!body.projectId || !UUID_RE.test(body.projectId) || !body.query) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId (uuid) and query are required",
        },
      },
      422,
    );
  }

  try {
    const project = await projectQueries(db).getById(body.projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const user = await userQueries(db).getById(userId);
    const effectivePlan = resolveEffectivePlan({
      plan: user?.plan ?? "free",
      trialEndsAt: user?.trialEndsAt ?? null,
    });
    const limits = PLAN_LIMITS[effectivePlan];

    if (limits.watchlistQueriesPerProject === 0) {
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_REACHED",
            message:
              "Watchlist queries are not available on your plan. Upgrade to Starter or above.",
          },
        },
        403,
      );
    }

    const scheduleQueries = competitorMonitoringScheduleQueries(db);
    const existingCount = await scheduleQueries.countByProject(body.projectId);
    if (existingCount >= limits.watchlistQueriesPerProject) {
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_REACHED",
            message: `Watchlist query limit reached (${limits.watchlistQueriesPerProject}). Upgrade your plan for more.`,
          },
        },
        403,
      );
    }

    const schedule = await scheduleQueries.create({
      projectId: body.projectId,
      query: body.query.trim(),
      providers: body.providers ?? ["chatgpt", "claude", "perplexity"],
      frequency: body.frequency ?? "weekly",
    });

    return c.json({ data: schedule }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /api/competitors/watchlist — List watchlist queries by project
competitorWatchlistRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");

  if (!projectId) {
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

  const schedules =
    await competitorMonitoringScheduleQueries(db).listByProject(projectId);

  return c.json({ data: schedules });
});

// PATCH /api/competitors/watchlist/:id — Update a watchlist query
competitorWatchlistRoutes.patch("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const scheduleId = c.req.param("id");

  if (!UUID_RE.test(scheduleId)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid watchlist query ID",
        },
      },
      422,
    );
  }

  const body = await c.req.json<{
    query?: string;
    providers?: string[];
    frequency?: string;
    enabled?: boolean;
  }>();

  try {
    const scheduleQueries = competitorMonitoringScheduleQueries(db);
    const schedule = await scheduleQueries.getById(scheduleId);
    if (!schedule) {
      return c.json(
        {
          error: { code: "NOT_FOUND", message: "Watchlist query not found" },
        },
        404,
      );
    }

    const project = await projectQueries(db).getById(schedule.projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        {
          error: { code: "NOT_FOUND", message: "Watchlist query not found" },
        },
        404,
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.query !== undefined) updateData.query = body.query.trim();
    if (body.providers !== undefined) updateData.providers = body.providers;
    if (body.frequency !== undefined) updateData.frequency = body.frequency;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;

    const updated = await scheduleQueries.update(
      scheduleId,
      updateData as Parameters<typeof scheduleQueries.update>[1],
    );

    return c.json({ data: updated });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// DELETE /api/competitors/watchlist/:id — Delete a watchlist query
competitorWatchlistRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const scheduleId = c.req.param("id");

  if (!UUID_RE.test(scheduleId)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid watchlist query ID",
        },
      },
      422,
    );
  }

  try {
    const scheduleQueries = competitorMonitoringScheduleQueries(db);
    const schedule = await scheduleQueries.getById(scheduleId);
    if (!schedule) {
      return c.json(
        {
          error: { code: "NOT_FOUND", message: "Watchlist query not found" },
        },
        404,
      );
    }

    const project = await projectQueries(db).getById(schedule.projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        {
          error: { code: "NOT_FOUND", message: "Watchlist query not found" },
        },
        404,
      );
    }

    await scheduleQueries.delete(scheduleId);

    return c.json({ success: true });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
