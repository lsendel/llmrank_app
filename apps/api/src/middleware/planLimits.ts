import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";
import { userQueries } from "@llm-boost/db";
import { PLAN_LIMITS, ERROR_CODES } from "@llm-boost/shared";

export const enforceCrawlCredits = createMiddleware<AppEnv>(async (c, next) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);

  if (!user) {
    const err = ERROR_CODES.NOT_FOUND;
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      err.status,
    );
  }

  if (user.crawlCreditsRemaining <= 0) {
    return c.json(
      {
        error: {
          code: "CRAWL_LIMIT_REACHED",
          message: "No crawl credits remaining. Upgrade your plan for more.",
        },
      },
      429,
    );
  }

  await next();
});

export const enforceProjectLimit = createMiddleware<AppEnv>(async (c, next) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);

  if (!user) {
    const err = ERROR_CODES.NOT_FOUND;
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      err.status,
    );
  }

  const limits = PLAN_LIMITS[user.plan];
  const { projectQueries } = await import("@llm-boost/db");
  const projects = await projectQueries(db).listByUser(userId);

  if (projects.length >= limits.projects) {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: `Your ${user.plan} plan allows up to ${limits.projects} projects. Upgrade for more.`,
        },
      },
      403,
    );
  }

  await next();
});
