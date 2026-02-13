import { Hono } from "hono";
import type { AppEnv } from "../index";
import { parseHtml } from "../lib/html-parser";
import { analyzeSitemap } from "../lib/sitemap";
import { scorePage, type PageData } from "@llm-boost/scoring";
import { getQuickWins } from "@llm-boost/shared";
import { crawlQueries, scoreQueries, pageQueries } from "@llm-boost/db";

export const publicRoutes = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// POST /api/public/scan — No-auth instant domain scan
// ---------------------------------------------------------------------------

publicRoutes.post("/scan", async (c) => {
  const body = await c.req.json<{ url: string }>();
  if (!body.url) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "url is required" } },
      422,
    );
  }

  // Normalize URL
  let targetUrl: URL;
  try {
    const raw = body.url.startsWith("http") ? body.url : `https://${body.url}`;
    targetUrl = new URL(raw);
  } catch {
    return c.json(
      { error: { code: "INVALID_DOMAIN", message: "Invalid URL provided" } },
      422,
    );
  }

  // KV rate limit: 10 scans per IP per hour
  const ip =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for") ??
    "unknown";
  const rateLimitKey = `public-scan:${ip}`;
  const currentCount = Number(await c.env.KV.get(rateLimitKey)) || 0;
  if (currentCount >= 10) {
    return c.json(
      {
        error: {
          code: "RATE_LIMIT",
          message:
            "Rate limit exceeded. Try again later or sign up for more scans.",
        },
      },
      429,
    );
  }
  await c.env.KV.put(rateLimitKey, String(currentCount + 1), {
    expirationTtl: 3600,
  });

  const domain = targetUrl.hostname;
  const pageUrl = targetUrl.toString();

  // Fetch HTML, robots.txt, llms.txt, and sitemap in parallel
  const fetchWithTimeout = async (url: string): Promise<Response | null> => {
    try {
      return await fetch(url, {
        headers: { "User-Agent": "AISEOBot/1.0" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return null;
    }
  };

  const [htmlResponse, robotsResponse, llmsResponse, sitemapResult] =
    await Promise.all([
      fetchWithTimeout(pageUrl),
      fetchWithTimeout(`https://${domain}/robots.txt`),
      fetchWithTimeout(`https://${domain}/llms.txt`),
      analyzeSitemap(domain),
    ]);

  if (!htmlResponse || !htmlResponse.ok) {
    return c.json(
      {
        error: {
          code: "FETCH_FAILED",
          message: `Could not fetch ${pageUrl} (status: ${htmlResponse?.status ?? "timeout"})`,
        },
      },
      422,
    );
  }

  const html = await htmlResponse.text();
  const parsed = parseHtml(html, pageUrl);

  // Parse robots.txt for AI crawler blocks
  const aiCrawlersBlocked: string[] = [];
  if (robotsResponse?.ok) {
    const robotsTxt = await robotsResponse.text();
    const aiAgents = [
      "GPTBot",
      "ClaudeBot",
      "PerplexityBot",
      "Google-Extended",
    ];
    for (const agent of aiAgents) {
      const agentBlock = new RegExp(
        `User-agent:\\s*${agent}[\\s\\S]*?Disallow:\\s*/`,
        "i",
      );
      if (agentBlock.test(robotsTxt)) {
        aiCrawlersBlocked.push(agent);
      }
    }
  }

  const hasLlmsTxt = llmsResponse?.ok ?? false;

  // Build content hash (simple hash for dedup — not needed for public scan)
  const contentHash = String(html.length);

  // Build PageData for scoring engine
  const pageData: PageData = {
    url: pageUrl,
    statusCode: htmlResponse.status,
    title: parsed.title,
    metaDescription: parsed.metaDescription,
    canonicalUrl: parsed.canonicalUrl,
    wordCount: parsed.wordCount,
    contentHash,
    extracted: {
      h1: parsed.h1,
      h2: parsed.h2,
      h3: parsed.h3,
      h4: parsed.h4,
      h5: parsed.h5,
      h6: parsed.h6,
      schema_types: parsed.schemaTypes,
      internal_links: parsed.internalLinks,
      external_links: parsed.externalLinks,
      images_without_alt: parsed.imagesWithoutAlt,
      has_robots_meta: parsed.hasRobotsMeta,
      robots_directives: parsed.robotsDirectives,
      og_tags: parsed.ogTags,
      structured_data: parsed.structuredData,
    },
    lighthouse: null,
    llmScores: null,
    siteContext: {
      hasLlmsTxt,
      aiCrawlersBlocked,
      hasSitemap: sitemapResult.exists,
      sitemapAnalysis: sitemapResult.exists
        ? {
            isValid: sitemapResult.isValid,
            urlCount: sitemapResult.urlCount,
            staleUrlCount: sitemapResult.staleUrlCount,
            discoveredPageCount: 1, // Only scanning 1 page in public scan
          }
        : undefined,
      contentHashes: new Map(),
    },
  };

  const result = scorePage(pageData);
  const quickWins = getQuickWins(result.issues);

  return c.json({
    data: {
      url: pageUrl,
      domain,
      scores: {
        overall: result.overallScore,
        technical: result.technicalScore,
        content: result.contentScore,
        aiReadiness: result.aiReadinessScore,
        performance: result.performanceScore,
        letterGrade: result.letterGrade,
      },
      issues: result.issues,
      quickWins,
      meta: {
        title: parsed.title,
        description: parsed.metaDescription,
        wordCount: parsed.wordCount,
        hasLlmsTxt,
        hasSitemap: sitemapResult.exists,
        sitemapUrls: sitemapResult.urlCount,
        aiCrawlersBlocked,
        schemaTypes: parsed.schemaTypes,
        ogTags: parsed.ogTags,
      },
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/public/reports/:token — View shared report
// ---------------------------------------------------------------------------

publicRoutes.get("/reports/:token", async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");

  const crawlJob = await crawlQueries(db).getByShareToken(token);
  if (!crawlJob) {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Report not found or sharing disabled",
        },
      },
      404,
    );
  }

  // Fetch scores and issues for this crawl
  const [pageScores, issues] = await Promise.all([
    scoreQueries(db).listByJobWithPages(crawlJob.id),
    scoreQueries(db).getIssuesByJob(crawlJob.id),
  ]);

  // Compute aggregate scores
  const avg = (vals: (number | null)[]) => {
    const nums = vals.filter((v): v is number => v !== null);
    return nums.length > 0
      ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
      : 0;
  };

  const overallScore = avg(pageScores.map((s) => s.overallScore));
  const technicalScore = avg(pageScores.map((s) => s.technicalScore));
  const contentScore = avg(pageScores.map((s) => s.contentScore));
  const aiReadinessScore = avg(pageScores.map((s) => s.aiReadinessScore));

  let letterGrade: string;
  if (overallScore >= 90) letterGrade = "A";
  else if (overallScore >= 80) letterGrade = "B";
  else if (overallScore >= 70) letterGrade = "C";
  else if (overallScore >= 60) letterGrade = "D";
  else letterGrade = "F";

  const quickWins = getQuickWins(issues);

  return c.json({
    data: {
      crawlId: crawlJob.id,
      completedAt: crawlJob.completedAt,
      pagesScored: crawlJob.pagesScored,
      scores: {
        overall: overallScore,
        technical: technicalScore,
        content: contentScore,
        aiReadiness: aiReadinessScore,
        letterGrade,
      },
      pages: pageScores.map((s) => ({
        url: s.page?.url ?? "unknown",
        title: s.page?.title ?? null,
        overallScore: s.overallScore,
        technicalScore: s.technicalScore,
        contentScore: s.contentScore,
        aiReadinessScore: s.aiReadinessScore,
        issueCount: s.issueCount,
      })),
      issueCount: issues.length,
      quickWins,
    },
  });
});
