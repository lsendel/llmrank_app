import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";

/** Detects HX-Request header; sets c.get("isHtmx") and c.get("hxTarget") */
export const htmxMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set("isHtmx", c.req.header("HX-Request") === "true");
  c.set("hxTarget", c.req.header("HX-Target") ?? null);
  await next();
});
