import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { hmacMiddleware } from "../middleware/hmac";
import { discoveredLinkQueries, projectQueries } from "@llm-boost/db";
import { ServiceError } from "../services/errors";

export const backlinkRoutes = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// POST /ingest — Receive discovered links from crawler (HMAC auth)
// ---------------------------------------------------------------------------

backlinkRoutes.post("/ingest", hmacMiddleware, async (c) => {
  const db = c.get("db");
  const body = await c.req.json<{
    links: {
      sourceUrl: string;
      sourceDomain: string;
      targetUrl: string;
      targetDomain: string;
      anchorText?: string;
      rel?: string;
    }[];
  }>();

  if (!body.links?.length) {
    return c.json({ data: { inserted: 0 } });
  }

  const queries = discoveredLinkQueries(db);
  await queries.upsertBatch(body.links);
  return c.json({ data: { inserted: body.links.length } });
});

// ---------------------------------------------------------------------------
// Authenticated routes below
// ---------------------------------------------------------------------------

backlinkRoutes.use("/project/*", authMiddleware);

// ---------------------------------------------------------------------------
// GET /project/:projectId — Backlink summary for a project's domain
// ---------------------------------------------------------------------------

backlinkRoutes.get("/project/:projectId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    throw new ServiceError("NOT_FOUND", 404, "Project not found");
  }

  const queries = discoveredLinkQueries(db);
  const summary = await queries.getSummary(project.domain);
  const topDomains = await queries.topReferringDomains(project.domain, 20);

  return c.json({
    data: {
      domain: project.domain,
      ...summary,
      topReferringDomains: topDomains,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /project/:projectId/links — Paginated backlinks list
// ---------------------------------------------------------------------------

backlinkRoutes.get("/project/:projectId/links", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
  const offset = Number(c.req.query("offset") ?? 0);

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    throw new ServiceError("NOT_FOUND", 404, "Project not found");
  }

  const queries = discoveredLinkQueries(db);
  const [links, total] = await Promise.all([
    queries.listForDomain(project.domain, limit, offset),
    queries.countForDomain(project.domain),
  ]);

  return c.json({ data: { links, total, limit, offset } });
});

// ---------------------------------------------------------------------------
// GET /project/:projectId/referring-domains — Top referring domains
// ---------------------------------------------------------------------------

backlinkRoutes.get("/project/:projectId/referring-domains", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    throw new ServiceError("NOT_FOUND", 404, "Project not found");
  }

  const queries = discoveredLinkQueries(db);
  const domains = await queries.topReferringDomains(project.domain, 50);

  return c.json({ data: domains });
});
