import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { notificationChannelQueries, userQueries } from "@llm-boost/db";
import { createNotificationChannelService } from "../services/notification-channel-service";
import { handleServiceError } from "../services/errors";

export const notificationChannelRoutes = new Hono<AppEnv>();

notificationChannelRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// Helper — build service from context
// ---------------------------------------------------------------------------

function buildService(c: { get(key: "db"): any }) {
  const db = c.get("db");
  const uq = userQueries(db);
  return createNotificationChannelService({
    channels: notificationChannelQueries(db),
    users: {
      getById: async (id: string) => (await uq.getById(id)) ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// POST / — Create a notification channel
// ---------------------------------------------------------------------------

notificationChannelRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    projectId?: string;
    channelType: "email" | "webhook" | "slack_incoming" | "slack_app";
    config: Record<string, unknown>;
    eventTypes: string[];
  }>();

  if (!body.channelType || !body.config || !body.eventTypes?.length) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "channelType, config, and eventTypes are required",
        },
      },
      422,
    );
  }

  const service = buildService(c);

  try {
    const channel = await service.create({
      userId,
      projectId: body.projectId,
      channelType: body.channelType,
      config: body.config,
      eventTypes: body.eventTypes,
    });
    return c.json({ data: channel }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET / — List notification channels for the authenticated user
// ---------------------------------------------------------------------------

notificationChannelRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const service = buildService(c);

  try {
    const channels = await service.list(userId);
    return c.json({ data: channels });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// PATCH /:id — Update a notification channel
// ---------------------------------------------------------------------------

notificationChannelRoutes.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const channelId = c.req.param("id");
  const body = await c.req.json<{
    config?: Record<string, unknown>;
    eventTypes?: string[];
    enabled?: boolean;
  }>();

  const service = buildService(c);

  try {
    const updated = await service.update(userId, channelId, body);
    return c.json({ data: updated });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — Delete a notification channel
// ---------------------------------------------------------------------------

notificationChannelRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const channelId = c.req.param("id");
  const service = buildService(c);

  try {
    await service.delete(userId, channelId);
    return c.json({ data: { success: true } });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
