import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { AppEnv } from "../index";
import { createAuth } from "../lib/auth";
import { authMiddleware } from "../middleware/auth";

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get("/", (c) => {
  return c.json({ status: "ok" });
});

healthRoutes.get("/auth-check", authMiddleware, async (c) => {
  const hasAuthSecret = !!c.env.BETTER_AUTH_SECRET;

  let dbStatus: string;
  try {
    const db = c.get("db");
    await db.execute(sql`SELECT 1` as any);
    dbStatus = "connected";
  } catch (e) {
    dbStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  let authStatus: string;
  try {
    const auth = createAuth(c.env);
    authStatus = auth ? "configured" : "not configured";
  } catch (e) {
    authStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return c.json({
    authProvider: "better-auth",
    authSecretConfigured: hasAuthSecret,
    authStatus,
    dbStatus,
  });
});
