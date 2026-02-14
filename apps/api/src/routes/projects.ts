import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  PaginationSchema,
} from "@llm-boost/shared";
import {
  createCrawlRepository,
  createProjectRepository,
  createScoreRepository,
  createUserRepository,
} from "../repositories";
import { createProjectService } from "../services/project-service";
import { handleServiceError } from "../services/errors";

export const projectRoutes = new Hono<AppEnv>();

// All project routes require authentication
projectRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET / — List user's projects (paginated)
// ---------------------------------------------------------------------------

projectRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const query = PaginationSchema.safeParse({
    page: c.req.query("page"),
    limit: c.req.query("limit"),
  });

  if (!query.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid pagination parameters",
          details: query.error.flatten(),
        },
      },
      422,
    );
  }

  const service = createProjectService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
    scores: createScoreRepository(db),
  });

  try {
    const result = await service.listForUser(userId, query.data);
    return c.json(result);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// POST / — Create a new project
// ---------------------------------------------------------------------------

projectRoutes.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = await c.req.json();
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid project data",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  const service = createProjectService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
    scores: createScoreRepository(db),
  });

  try {
    const project = await service.createProject(userId, parsed.data);
    return c.json({ data: project }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:id — Get project detail with latest crawl
// ---------------------------------------------------------------------------

projectRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const service = createProjectService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
    scores: createScoreRepository(db),
  });

  try {
    const data = await service.getProjectDetail(userId, projectId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// PUT /:id — Update project
// ---------------------------------------------------------------------------

projectRoutes.put("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const body = await c.req.json();
  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid update data",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  const service = createProjectService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
    scores: createScoreRepository(db),
  });

  try {
    const updated = await service.updateProject(userId, projectId, parsed.data);
    return c.json({ data: updated });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — Soft delete
// ---------------------------------------------------------------------------

projectRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const service = createProjectService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
    scores: createScoreRepository(db),
  });

  try {
    const result = await service.deleteProject(userId, projectId);
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
