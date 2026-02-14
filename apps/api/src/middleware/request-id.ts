import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";

export const requestIdMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);
  await next();
});
