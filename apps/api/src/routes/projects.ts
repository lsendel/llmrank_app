import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { withOwnership } from "../middleware/ownership";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  PaginationSchema,
} from "@llm-boost/shared";
import { handleServiceError } from "../services/errors";
import {
  toProjectResponse,
  toProjectDetailResponse,
  toProjectListResponse,
} from "../dto/project.dto";

export const projectRoutes = new Hono<AppEnv>();

// All project routes require authentication
projectRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET / — List user's projects (paginated)
// ---------------------------------------------------------------------------

projectRoutes.get("/", async (c) => {
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

  const { projectService } = c.get("container");

  try {
    const result = await projectService.listForUser(userId, query.data);
    return c.json({
      ...result,
      data: toProjectListResponse(result.data),
    });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// POST / — Create a new project
// ---------------------------------------------------------------------------

projectRoutes.post("/", async (c) => {
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

  const { projectService } = c.get("container");

  try {
    const project = await projectService.createProject(userId, parsed.data);
    return c.json({ data: toProjectResponse(project) }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:id — Get project detail with latest crawl
// ---------------------------------------------------------------------------

projectRoutes.get("/:id", withOwnership("project"), async (c) => {
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const { projectService } = c.get("container");

  try {
    const data = await projectService.getProjectDetail(userId, projectId);
    return c.json({ data: toProjectDetailResponse(data) });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// PUT /:id — Update project
// ---------------------------------------------------------------------------

projectRoutes.put("/:id", withOwnership("project"), async (c) => {
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

  const { projectService } = c.get("container");

  try {
    const updated = await projectService.updateProject(
      userId,
      projectId,
      parsed.data,
    );
    return c.json({ data: toProjectResponse(updated) });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — Soft delete
// ---------------------------------------------------------------------------

projectRoutes.delete("/:id", withOwnership("project"), async (c) => {
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const { projectService } = c.get("container");

  try {
    const result = await projectService.deleteProject(userId, projectId);
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:id/progress — Cross-crawl improvement progress
// ---------------------------------------------------------------------------

projectRoutes.get("/:id/progress", withOwnership("project"), async (c) => {
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const { progressService } = c.get("container");

  try {
    const data = await progressService.getProjectProgress(userId, projectId);
    if (!data) {
      return c.json({
        data: null,
        message: "Need at least 2 completed crawls",
      });
    }
    c.header("Cache-Control", "public, max-age=300");
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
