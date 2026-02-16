import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { crawlQueries, pageQueries, projectQueries } from "@llm-boost/db";
import { createGeneratorService } from "../services/generator-service";

export const generatorRoutes = new Hono<AppEnv>();
generatorRoutes.use("*", authMiddleware);

// POST /api/projects/:id/generate/sitemap
generatorRoutes.post("/:id/generate/sitemap", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
  if (!latestCrawl || latestCrawl.status !== "complete") {
    return c.json(
      {
        error: {
          code: "NO_CRAWL",
          message: "No completed crawl found. Run a crawl first.",
        },
      },
      404,
    );
  }

  const pages = await pageQueries(db).listByJob(latestCrawl.id);
  const gen = createGeneratorService();
  const xml = gen.generateSitemap(
    pages
      .filter((p) => p.statusCode === 200)
      .map((p) => ({
        url: p.url,
        lastmod: latestCrawl.completedAt?.toISOString().split("T")[0],
      })),
  );

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Content-Disposition": `attachment; filename="${project.domain}-sitemap.xml"`,
    },
  });
});

// POST /api/projects/:id/generate/llms-txt
generatorRoutes.post("/:id/generate/llms-txt", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
  if (!latestCrawl || latestCrawl.status !== "complete") {
    return c.json(
      {
        error: {
          code: "NO_CRAWL",
          message: "No completed crawl found. Run a crawl first.",
        },
      },
      404,
    );
  }

  const pages = await pageQueries(db).listByJob(latestCrawl.id);
  const gen = createGeneratorService();
  const txt = gen.generateLlmsTxt({
    title: project.name,
    description: `AI-optimized content from ${project.domain}`,
    pages: pages
      .filter((p) => p.statusCode === 200 && p.title)
      .map((p) => ({
        url: p.url,
        title: p.title!,
        description: p.metaDesc ?? undefined,
      })),
  });

  return new Response(txt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.domain}-llms.txt"`,
    },
  });
});
