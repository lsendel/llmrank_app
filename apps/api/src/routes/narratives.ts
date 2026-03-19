import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  GenerateNarrativeSchema,
  EditNarrativeSectionSchema,
  RegenerateNarrativeSectionSchema,
} from "@llm-boost/shared";
import { createNarrativeService } from "../services/narrative-service";
import {
  createNarrativeRepository,
  createProjectRepository,
  createUserRepository,
  createCrawlRepository,
} from "@llm-boost/repositories";
import { handleServiceError } from "../lib/error-handler";

export const narrativeRoutes = new Hono<AppEnv>();

narrativeRoutes.use("*", authMiddleware);

// POST /api/narratives/generate — Trigger narrative generation
narrativeRoutes.post("/generate", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json();

  const parsed = GenerateNarrativeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  const service = createNarrativeService({
    narratives: createNarrativeRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  try {
    const result = await service.generate(
      userId,
      parsed.data.crawlJobId,
      parsed.data.tone,
      { anthropicApiKey: c.env.ANTHROPIC_API_KEY },
    );
    return c.json({ data: result }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /api/narratives/:crawlJobId — Fetch narrative for a crawl
narrativeRoutes.get("/:crawlJobId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlJobId = c.req.param("crawlJobId");
  const tone = (c.req.query("tone") ?? "technical") as "technical" | "business";

  const service = createNarrativeService({
    narratives: createNarrativeRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  try {
    const result = await service.get(userId, crawlJobId, tone);
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// PATCH /api/narratives/:crawlJobId/sections/:sectionId — Edit section (Agency)
narrativeRoutes.patch("/:crawlJobId/sections/:sectionId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlJobId = c.req.param("crawlJobId");
  const sectionId = c.req.param("sectionId");
  const body = await c.req.json();

  const parsed = EditNarrativeSectionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  const service = createNarrativeService({
    narratives: createNarrativeRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  try {
    const result = await service.editSection(
      userId,
      crawlJobId,
      sectionId,
      parsed.data.editedContent,
    );
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// POST /api/narratives/:crawlJobId/sections/:sectionType/regenerate
narrativeRoutes.post(
  "/:crawlJobId/sections/:sectionType/regenerate",
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const crawlJobId = c.req.param("crawlJobId");
    const sectionType = c.req.param("sectionType");
    const body = await c.req.json().catch(() => ({}));

    const parsed = RegenerateNarrativeSectionSchema.safeParse(body);

    const service = createNarrativeService({
      narratives: createNarrativeRepository(db),
      projects: createProjectRepository(db),
      users: createUserRepository(db),
      crawls: createCrawlRepository(db),
    });

    try {
      const result = await service.regenerateSection(
        userId,
        crawlJobId,
        sectionType as any,
        parsed.success ? parsed.data.instructions : undefined,
        { anthropicApiKey: c.env.ANTHROPIC_API_KEY },
      );
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error);
    }
  },
);

// DELETE /api/narratives/:crawlJobId
narrativeRoutes.delete("/:crawlJobId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlJobId = c.req.param("crawlJobId");

  const service = createNarrativeService({
    narratives: createNarrativeRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  try {
    await service.delete(userId, crawlJobId);
    return c.json({ data: { deleted: true } });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
