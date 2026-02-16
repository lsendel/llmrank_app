import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { scoringProfileQueries, projectQueries } from "@llm-boost/db";
import { SCORING_PRESETS } from "@llm-boost/scoring";
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
  preset: z.string().optional(),
  disabledFactors: z.array(z.string()).optional(),
});

// GET / — List user's profiles + presets
scoringProfileRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const profiles = await scoringProfileQueries(db).listByUser(userId);
  return c.json({ data: { profiles, presets: SCORING_PRESETS } });
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

  // If a preset name is given, use its weights
  const { preset, ...rest } = body.data;
  const createData =
    preset && SCORING_PRESETS[preset]
      ? { ...rest, weights: SCORING_PRESETS[preset] }
      : rest;

  const profile = await scoringProfileQueries(db).create({
    userId,
    ...createData,
  });
  return c.json({ data: profile }, 201);
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

// PUT /assign/:projectId — Assign a scoring profile to a project
scoringProfileRoutes.put("/assign/:projectId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  // Verify project ownership
  const pq = projectQueries(db);
  const project = await pq.getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const body = z
    .object({ scoringProfileId: z.string().uuid().nullable() })
    .safeParse(await c.req.json());
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

  // If assigning a profile, verify ownership of the profile
  if (body.data.scoringProfileId) {
    const profile = await scoringProfileQueries(db).getById(
      body.data.scoringProfileId,
    );
    if (!profile || profile.userId !== userId) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Scoring profile not found",
          },
        },
        404,
      );
    }
  }

  const updated = await pq.update(projectId, {
    scoringProfileId: body.data.scoringProfileId,
  });
  return c.json({ data: updated });
});
