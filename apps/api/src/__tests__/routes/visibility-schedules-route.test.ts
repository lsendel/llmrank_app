import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Bindings } from "../../index";

const authMiddlewareMock = vi.hoisted(() =>
  vi.fn().mockImplementation(async (_c, next) => {
    await next();
  }),
);

vi.mock("../../middleware/auth", () => ({
  authMiddleware: authMiddlewareMock,
}));

import { visibilityScheduleRoutes } from "../../routes/visibility-schedules";

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as any);
    c.set("userId", "user-1");
    await next();
  });
  app.route("/api/visibility-schedules", visibilityScheduleRoutes);
  return app;
}

const baseEnv = {} as unknown as Bindings;

describe("visibilityScheduleRoutes frequency validation", () => {
  it("returns 422 for invalid frequency on create", async () => {
    const app = createApp();

    const res = await app.fetch(
      new Request("http://localhost/api/visibility-schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: "project-1",
          query: "best crm software",
          providers: ["chatgpt"],
          frequency: "monthly",
        }),
      }),
      baseEnv,
    );

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "frequency must be one of: hourly, daily, weekly",
      },
    });
  });

  it("returns 422 for invalid frequency on update", async () => {
    const app = createApp();

    const res = await app.fetch(
      new Request("http://localhost/api/visibility-schedules/sq-1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          frequency: "monthly",
        }),
      }),
      baseEnv,
    );

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "frequency must be one of: hourly, daily, weekly",
      },
    });
  });
});
