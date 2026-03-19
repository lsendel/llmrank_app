import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { handleServiceError } from "../lib/error-handler";
import { createDeploymentService } from "../services/deployment-service";

export const deploymentRoutes = new Hono<AppEnv>();

// All routes require authentication
deploymentRoutes.use("*", authMiddleware);

// GET /deployment/status - Get current deployment status
deploymentRoutes.get("/status", async (c) => {
  const deploymentService = createDeploymentService({
    kv: c.env.KV,
    fetch:
      ((c.env as Record<string, unknown>).FETCH_BINDING as typeof fetch) ||
      fetch,
  });

  try {
    const status = await deploymentService.checkDeploymentHealth();
    return c.json({ data: status });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /deployment/current - Get current deployment manifest
deploymentRoutes.get("/current", async (c) => {
  const deploymentService = createDeploymentService({
    kv: c.env.KV,
  });

  try {
    const manifest = await deploymentService.getCurrentDeployment();
    if (!manifest) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "No deployment found" } },
        404,
      );
    }
    return c.json({ data: manifest });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /deployment/history - Get deployment history
deploymentRoutes.get("/history", async (c) => {
  const limit = Number(c.req.query("limit") || "10");

  const deploymentService = createDeploymentService({
    kv: c.env.KV,
  });

  try {
    const history = await deploymentService.getDeploymentHistory(limit);
    return c.json({ data: history });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// POST /deployment/rollback - Trigger rollback (admin only)
deploymentRoutes.post("/rollback", async (c) => {
  const userId = c.get("userId");

  // Check if user is admin
  const db = c.get("db");
  const { userQueries } = await import("@llm-boost/db");
  const user = await userQueries(db).getById(userId);

  if (!user || (user as Record<string, unknown>).role !== "admin") {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Only admins can trigger rollbacks",
        },
      },
      403,
    );
  }

  const body = await c.req.json().catch(() => ({}));

  const deploymentService = createDeploymentService({
    kv: c.env.KV,
  });

  try {
    const result = await deploymentService.rollback({
      service: body.service,
      dryRun: body.dryRun ?? false,
      reason: body.reason,
    });

    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// POST /deployment/auto-rollback - Check and auto-rollback if unhealthy
deploymentRoutes.post("/auto-rollback", async (c) => {
  const deploymentService = createDeploymentService({
    kv: c.env.KV,
    fetch:
      ((c.env as Record<string, unknown>).FETCH_BINDING as typeof fetch) ||
      fetch,
  });

  try {
    const result = await deploymentService.autoRollbackIfUnhealthy(300);

    if (!result) {
      return c.json({
        data: { message: "Deployment is healthy, no rollback needed" },
      });
    }

    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
