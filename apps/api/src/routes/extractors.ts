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

  const rawBody = await c.req.json().catch(() => null);
  if (!rawBody) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      422,
    );
  }
  const allowedFields: Record<string, unknown> = {};
  if (typeof rawBody.name === "string") allowedFields.name = rawBody.name;
  if (typeof rawBody.type === "string") {
    if (rawBody.type !== "css_selector" && rawBody.type !== "regex") {
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
    allowedFields.type = rawBody.type;
  }
  if (typeof rawBody.selector === "string")
    allowedFields.selector = rawBody.selector;
  if (typeof rawBody.attribute === "string" || rawBody.attribute === null) {
    allowedFields.attribute = rawBody.attribute;
  }
  if (Object.keys(allowedFields).length === 0) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "At least one field required",
        },
      },
      422,
    );
  }
  const updated = await extractorQueries(db).update(
    c.req.param("id"),
    projectId,
    allowedFields,
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
