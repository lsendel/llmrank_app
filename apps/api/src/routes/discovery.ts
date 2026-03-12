import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import {
  projectQueries,
  personaQueries,
  savedKeywordQueries,
  competitorQueries,
  crawlQueries,
  pageQueries,
} from "@llm-boost/db";
import { handleServiceError } from "../services/errors";
import { z } from "zod";

const BLOCKED_DOMAINS = new Set([
  "wikipedia.org",
  "reddit.com",
  "youtube.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "linkedin.com",
  "github.com",
  "medium.com",
  "quora.com",
  "amazon.com",
  "google.com",
]);

export const discoveryRoutes = new Hono<AppEnv>();
discoveryRoutes.use("*", authMiddleware);

// Trigger full auto-discovery pipeline
discoveryRoutes.post(
  "/:projectId/run",
  rateLimit({ limit: 2, windowSeconds: 300, keyPrefix: "rl:discovery" }),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("projectId");

    try {
      const project = await projectQueries(db).getById(projectId);
      if (!project || project.userId !== userId) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "Project not found" } },
          404,
        );
      }

      const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
      if (!latestCrawl) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "No crawl data available. Run a crawl first.",
            },
          },
          404,
        );
      }

      const allPages = await pageQueries(db).listByJob(latestCrawl.id);
      const indexPage = allPages[0];
      if (!indexPage) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "No pages found in latest crawl.",
            },
          },
          404,
        );
      }

      const { createDiscoveryService } =
        await import("../services/discovery-service");
      const service = createDiscoveryService({
        perplexityApiKey: c.env.PERPLEXITY_API_KEY,
        anthropicApiKey: c.env.ANTHROPIC_API_KEY,
        personaRepo: personaQueries(db),
        keywordRepo: savedKeywordQueries(db),
        competitorRepo: competitorQueries(db),
      });

      const result = await service.runFullDiscovery(
        {
          url: indexPage.url,
          title: indexPage.title,
          metaDescription: indexPage.metaDesc,
        },
        projectId,
      );

      return c.json({ data: result }, 201);
    } catch (error) {
      return handleServiceError(c, error);
    }
  },
);

// Lightweight competitor suggestions for the onboarding wizard
const SuggestCompetitorsSchema = z.object({
  keywords: z.array(z.string()).max(20).optional().default([]),
  goal: z.string().optional(),
});

discoveryRoutes.post(
  "/:projectId/suggest-competitors",
  rateLimit({ limit: 5, windowSeconds: 300, keyPrefix: "rl:suggest-comp" }),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("projectId");

    const project = await projectQueries(db).getById(projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const body = await c.req.json();
    const parsed = SuggestCompetitorsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        },
        422,
      );
    }

    if (!c.env.ANTHROPIC_API_KEY) {
      return c.json({ data: { competitors: [] } });
    }

    // Gather context from project + latest crawl
    const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
    let pageTitle = "";
    let metaDesc = "";
    if (latestCrawl) {
      const pages = await pageQueries(db).listByJob(latestCrawl.id);
      if (pages[0]) {
        pageTitle = pages[0].title ?? "";
        metaDesc = pages[0].metaDesc ?? "";
      }
    }

    const contextParts = [
      `Domain: ${project.domain}`,
      pageTitle && `Page title: ${pageTitle}`,
      metaDesc && `Meta description: ${metaDesc}`,
      project.siteDescription && `Site description: ${project.siteDescription}`,
      project.industry && `Industry: ${project.industry}`,
      parsed.data.keywords.length > 0 &&
        `Target keywords: ${parsed.data.keywords.join(", ")}`,
      parsed.data.goal && `Business goal: ${parsed.data.goal}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system:
          "You identify competitor websites. Return a JSON array of objects with 'domain' and 'reason' fields. Return 5-8 competitors. Only return actual competitor domains, not aggregators, directories, or social platforms.",
        messages: [
          {
            role: "user",
            content: `Identify the top competitors for this website:\n\n${contextParts}`,
          },
        ],
      });

      const text =
        response.content[0]?.type === "text" ? response.content[0].text : "[]";
      const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();

      let competitors: Array<{ domain: string; reason: string }> = [];
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          competitors = parsed
            .filter((c: any) => c.domain && typeof c.domain === "string")
            .map((c: any) => ({
              domain: c.domain.toLowerCase().replace(/^www\./, ""),
              reason: String(c.reason ?? ""),
            }))
            .filter(
              (c) =>
                !BLOCKED_DOMAINS.has(c.domain) && c.domain !== project.domain,
            );
        }
      } catch {
        competitors = [];
      }

      return c.json({ data: { competitors } });
    } catch {
      return c.json({ data: { competitors: [] } });
    }
  },
);
