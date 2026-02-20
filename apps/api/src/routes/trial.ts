import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { userQueries } from "@llm-boost/db";

const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

export const trialRoutes = new Hono<AppEnv>();
trialRoutes.use("*", authMiddleware);

// POST /start — Start 14-day Pro trial
trialRoutes.post("/start", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const user = await userQueries(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  if (user.trialStartedAt) {
    return c.json(
      {
        error: {
          code: "TRIAL_ALREADY_USED",
          message: "You have already used your free trial",
        },
      },
      409,
    );
  }

  if (user.plan !== "free") {
    return c.json(
      {
        error: {
          code: "ALREADY_PAID",
          message: "You already have a paid plan",
        },
      },
      409,
    );
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + TRIAL_DURATION_MS);

  await userQueries(db).startTrial(userId, now, endsAt);

  return c.json({
    data: {
      trialStartedAt: now.toISOString(),
      trialEndsAt: endsAt.toISOString(),
      daysRemaining: 14,
    },
  });
});

// GET /status — Get trial status
trialRoutes.get("/status", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const user = await userQueries(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  if (!user.trialStartedAt) {
    return c.json({
      data: { eligible: user.plan === "free", active: false },
    });
  }

  const endsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const active = endsAt ? endsAt > new Date() : false;
  const daysRemaining = endsAt
    ? Math.max(
        0,
        Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      )
    : 0;

  return c.json({
    data: {
      eligible: false,
      active,
      trialStartedAt: user.trialStartedAt,
      trialEndsAt: endsAt?.toISOString() ?? null,
      daysRemaining,
    },
  });
});
