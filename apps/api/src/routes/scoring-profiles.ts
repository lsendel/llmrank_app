import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { scoringProfileQueries } from "@llm-boost/db";
import { z } from "zod";

export const scoringProfileRoutes = new Hono<AppEnv>();
scoringProfileRoutes.use("*", authMiddleware);

const createSchema = z.object({
  name: z.string().min(1).max(128),
  weights: z
    .object({
      technical: z.number().min(0).max(100),
      content: z.number().min(0).max(100),
      aiReadiness: z.number().min(0).max(100),
      performance: z.number().min(0).max(100),
    })
    .refine(
      (w) => w.technical + w.content + w.aiReadiness + w.performance === 100,
      { message: "Weights must sum to 100" },
    ),
  disabledFactors: z.array(z.string()).optional(),
});

// POST / — Create profile
scoringProfileRoutes.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = createSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: body.error.flatten(),
        },
      },
      422,
    );
  }
  const profile = await scoringProfileQueries(db).create({
    userId,
    ...body.data,
  });
  return c.json({ data: profile }, 201);
});

// GET / — List user's profiles
scoringProfileRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const profiles = await scoringProfileQueries(db).listByUser(userId);
  return c.json({ data: profiles });
});

// PUT /:id — Update profile
scoringProfileRoutes.put("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const existing = await scoringProfileQueries(db).getById(id);
  if (!existing || existing.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Profile not found" } },
      404,
    );
  }
  const body = createSchema.partial().safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request" } },
      422,
    );
  }
  const updated = await scoringProfileQueries(db).update(id, body.data);
  return c.json({ data: updated });
});

// DELETE /:id — Delete profile
scoringProfileRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const existing = await scoringProfileQueries(db).getById(id);
  if (!existing || existing.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Profile not found" } },
      404,
    );
  }
  await scoringProfileQueries(db).delete(id);
  return c.json({ data: { deleted: true } });
});
