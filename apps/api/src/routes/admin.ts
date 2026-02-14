import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";
import { createAdminRepository } from "../repositories";
import { createAdminService } from "../services/admin-service";
import { createMonitoringService } from "../services/monitoring-service";
import { createNotificationService } from "../services/notification-service";
import { handleServiceError } from "../services/errors";

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use("*", authMiddleware, adminMiddleware);

function buildAdminService(c: Context<AppEnv>) {
  return createAdminService({ admin: createAdminRepository(c.get("db")) });
}

adminRoutes.get("/stats", async (c) => {
  const service = buildAdminService(c);
  const stats = await service.getStats();
  return c.json({ data: stats });
});

adminRoutes.get("/metrics", async (c) => {
  const db = c.get("db");
  const notifications = createNotificationService(db, c.env.RESEND_API_KEY);
  const monitor = createMonitoringService(db, notifications);

  try {
    const metrics = await monitor.getSystemMetrics();
    return c.json({ data: metrics });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

adminRoutes.get("/customers", async (c) => {
  const service = buildAdminService(c);
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const limit = parseInt(c.req.query("limit") ?? "25", 10);
  const search = c.req.query("search") ?? undefined;

  const result = await service.getCustomers({ page, limit, search });
  return c.json(result);
});

adminRoutes.get("/customers/:id", async (c) => {
  const service = buildAdminService(c);
  try {
    const detail = await service.getCustomerDetail(c.req.param("id"));
    return c.json({ data: detail });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

adminRoutes.get("/ingest", async (c) => {
  const service = buildAdminService(c);
  try {
    const detail = await service.getIngestDetails();
    return c.json({ data: detail });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

adminRoutes.post("/ingest/jobs/:id/retry", async (c) => {
  const service = buildAdminService(c);
  try {
    const result = await service.retryCrawlJob(
      c.req.param("id"),
      c.get("userId"),
    );
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

adminRoutes.post("/ingest/jobs/:id/cancel", async (c) => {
  const service = buildAdminService(c);
  const body = (await c.req.json<{ reason?: string }>().catch(() => ({}))) as {
    reason?: string;
  };
  try {
    const result = await service.cancelCrawlJob(
      c.req.param("id"),
      body.reason ?? "Cancelled by admin",
      c.get("userId"),
    );
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

adminRoutes.post("/ingest/outbox/:id/replay", async (c) => {
  const service = buildAdminService(c);
  try {
    const result = await service.replayOutboxEvent(
      c.req.param("id"),
      c.get("userId"),
    );
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
