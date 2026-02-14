import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { requireProjectOwnership } from "../middleware/ownership";
import { extractorQueries } from "@llm-boost/db";

export const extractorRoutes = new Hono<AppEnv>();

// GET /:projectId — list extractors
extractorRoutes.get("/:projectId", authMiddleware, async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("projectId");

  const ownership = await requireProjectOwnership(c, projectId);
  if (!ownership.ok) return ownership.response;

  const extractors = await extractorQueries(db).listByProject(projectId);
  return c.json({ data: extractors });
});

// POST /:projectId — create extractor
extractorRoutes.post("/:projectId", authMiddleware, async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("projectId");

  const ownership = await requireProjectOwnership(c, projectId);
  if (!ownership.ok) return ownership.response;

  const body = await c.req.json<{
    name: string;
    type: string;
    selector: string;
    attribute?: string;
  }>();

  if (!body.name || !body.type || !body.selector) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "name, type, and selector required",
        },
      },
      422,
    );
  }

  if (body.type !== "css_selector" && body.type !== "regex") {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "type must be css_selector or regex",
        },
      },
      422,
    );
  }

  const extractor = await extractorQueries(db).create({ ...body, projectId });
  return c.json({ data: extractor }, 201);
});

// PUT /:projectId/:id — update extractor
extractorRoutes.put("/:projectId/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("projectId");

  const ownership = await requireProjectOwnership(c, projectId);
  if (!ownership.ok) return ownership.response;

  const updated = await extractorQueries(db).update(
    c.req.param("id"),
    projectId,
    await c.req.json(),
  );
  if (!updated) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Extractor not found" } },
      404,
    );
  }
  return c.json({ data: updated });
});

// DELETE /:projectId/:id — remove extractor
extractorRoutes.delete("/:projectId/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("projectId");

  const ownership = await requireProjectOwnership(c, projectId);
  if (!ownership.ok) return ownership.response;

  await extractorQueries(db).remove(c.req.param("id"), projectId);
  return c.json({ data: { deleted: true } });
});
