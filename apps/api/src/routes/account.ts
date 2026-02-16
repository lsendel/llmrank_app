import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { userQueries } from "@llm-boost/db";
import { UpdateProfileSchema } from "@llm-boost/shared";

export const accountRoutes = new Hono<AppEnv>();
accountRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET / — Get current user info
// ---------------------------------------------------------------------------

accountRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }
  return c.json({ data: user });
});

// ---------------------------------------------------------------------------
// PUT / — Update profile (name, phone)
// ---------------------------------------------------------------------------

accountRoutes.put("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422,
    );
  }
  const updated = await userQueries(db).updateProfile(userId, parsed.data);
  return c.json({ data: updated });
});

// ---------------------------------------------------------------------------
// GET /notifications — Get notification preferences
// ---------------------------------------------------------------------------

accountRoutes.get("/notifications", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }
  return c.json({
    data: {
      notifyOnCrawlComplete: user.notifyOnCrawlComplete,
      notifyOnScoreDrop: user.notifyOnScoreDrop,
      webhookUrl: user.webhookUrl ?? null,
    },
  });
});

// ---------------------------------------------------------------------------
// PUT /notifications — Update notification preferences
// ---------------------------------------------------------------------------

accountRoutes.put("/notifications", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json();

  const data: {
    notifyOnCrawlComplete?: boolean;
    notifyOnScoreDrop?: boolean;
    webhookUrl?: string | null;
  } = {};
  if (typeof body.notifyOnCrawlComplete === "boolean") {
    data.notifyOnCrawlComplete = body.notifyOnCrawlComplete;
  }
  if (typeof body.notifyOnScoreDrop === "boolean") {
    data.notifyOnScoreDrop = body.notifyOnScoreDrop;
  }
  if ("webhookUrl" in body) {
    if (body.webhookUrl === null || body.webhookUrl === "") {
      data.webhookUrl = null;
    } else if (
      typeof body.webhookUrl === "string" &&
      body.webhookUrl.startsWith("https://")
    ) {
      data.webhookUrl = body.webhookUrl;
    } else {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Webhook URL must be an HTTPS URL",
          },
        },
        422,
      );
    }
  }

  const updated = await userQueries(db).updateNotifications(userId, data);
  return c.json({ data: updated });
});
