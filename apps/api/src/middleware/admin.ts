import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";
import { userQueries } from "@llm-boost/db";

export const adminMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const user = await userQueries(db).getById(userId);
  if (!user?.isAdmin) {
    return c.json(
      { error: { code: "FORBIDDEN", message: "Admin access required" } },
      403,
    );
  }

  await next();
});
