import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";
import { adminQueries } from "@llm-boost/db";

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use("*", authMiddleware, adminMiddleware);

adminRoutes.get("/stats", async (c) => {
  const db = c.get("db");
  const stats = await adminQueries(db).getStats();
  return c.json({ data: stats });
});

adminRoutes.get("/customers", async (c) => {
  const db = c.get("db");
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const limit = parseInt(c.req.query("limit") ?? "25", 10);
  const search = c.req.query("search") ?? undefined;

  const result = await adminQueries(db).getCustomers({ page, limit, search });
  return c.json(result);
});

adminRoutes.get("/customers/:id", async (c) => {
  const db = c.get("db");
  const detail = await adminQueries(db).getCustomerDetail(c.req.param("id"));

  if (!detail) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Customer not found" } },
      404,
    );
  }

  return c.json({ data: detail });
});
