import { Hono } from "hono";
import type { AppEnv } from "../index";
import { RobotsParser } from "@llm-boost/shared";
import { parseHtml } from "../lib/html-parser";
import { analyzeSitemap } from "../lib/sitemap";
import { scorePage, type PageData } from "@llm-boost/scoring";
import { getQuickWins, AI_BOT_USER_AGENT_NAMES } from "@llm-boost/shared";
import { VisibilityChecker } from "@llm-boost/llm";
import { scanResultQueries } from "@llm-boost/db";
import { badgeRoutes } from "./badge";

export const publicRoutes = new Hono<AppEnv>();

publicRoutes.route("/badge", badgeRoutes);

// ---------------------------------------------------------------------------
// GET /api/public/benchmarks — Public percentile data
// ---------------------------------------------------------------------------

publicRoutes.get("/benchmarks", async (c) => {
  const data = await c.env.KV.get("benchmarks:overall", "json");
  if (!data) return c.json({ data: null });
  return c.json({ data });
});

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
      const res = await fetch(url, {
        headers: { "User-Agent": "AISEOBot/1.0" },
        signal: AbortSignal.timeout(10_000),
      });
      return res;
    } catch (err) {
      console.error(`Fetch failed for ${url}:`, err);
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
          message: `Could not fetch ${pageUrl} (status: ${htmlResponse?.status ?? "timeout/error"})`,
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
    const parser = new RobotsParser(robotsTxt);
    for (const agent of AI_BOT_USER_AGENT_NAMES) {
      if (!parser.isAllowed(pageUrl, agent)) {
        aiCrawlersBlocked.push(agent);
      }
    }
  }

  let hasLlmsTxt = false;

  if (llmsResponse?.ok) {
    const rawLlms = await llmsResponse.text();
    if (rawLlms.trim().length > 0) {
      hasLlmsTxt = true;
      // Optional: Store parsed content if needed, but for public scan we just check existence
      // const parser = new LlmsTxtParser(rawLlms);
      // const result = parser.parse();
    }
  }

  // Build content hash using SHA-256 for proper deduplication
  const htmlBytes = new TextEncoder().encode(html);
  const hashBuffer = await crypto.subtle.digest("SHA-256", htmlBytes);
  const contentHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

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
      pdf_links: [],
      cors_unsafe_blank_links: 0,
      cors_mixed_content: 0,
      cors_has_issues: false,
      sentence_length_variance: null,
      top_transition_words: [],
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

  // Run visibility probes across multiple providers — best-effort, don't block on failure
  let visibility: any[] = [];

  const apiKeys: Record<string, string> = {};
  if (c.env.PERPLEXITY_API_KEY) apiKeys.perplexity = c.env.PERPLEXITY_API_KEY;
  if (c.env.OPENAI_API_KEY) apiKeys.chatgpt = c.env.OPENAI_API_KEY;
  if (c.env.ANTHROPIC_API_KEY) apiKeys.claude = c.env.ANTHROPIC_API_KEY;
  if (c.env.GEMINI_API_KEY) apiKeys.gemini = c.env.GEMINI_API_KEY;

  if (Object.keys(apiKeys).length > 0) {
    try {
      const checker = new VisibilityChecker();
      const autoQuery = `What is ${domain} known for?`;
      const results = await checker.checkAllProviders({
        query: autoQuery,
        targetDomain: domain,
        competitors: [],
        providers: Object.keys(apiKeys),
        apiKeys,
      });
      visibility = results.map((r) => ({
        provider: r.provider,
        brandMentioned: r.brandMentioned,
        urlCited: r.urlCited,
        citationPosition: r.citationPosition,
        competitorMentions: r.competitorMentions,
      }));
    } catch (err) {
      console.error(
        `[public-scan] Visibility probe failed for domain="${domain}":`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Persist scan result to DB
  const db = c.get("db");
  const ipBytes = new TextEncoder().encode(ip);
  const ipHashBuf = await crypto.subtle.digest("SHA-256", ipBytes);
  const ipHash = Array.from(new Uint8Array(ipHashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const scores = {
    overall: result.overallScore,
    technical: result.technicalScore,
    content: result.contentScore,
    aiReadiness: result.aiReadinessScore,
    performance: result.performanceScore,
    letterGrade: result.letterGrade,
  };

  const scanResult = await scanResultQueries(db).create({
    domain,
    url: pageUrl,
    scores,
    issues: result.issues,
    quickWins,
    siteContext: pageData.siteContext,
    ipHash,
  });

  return c.json({
    data: {
      scanResultId: scanResult.id,
      url: pageUrl,
      domain,
      scores,
      issues: result.issues.slice(0, 3),
      quickWins,
      meta: {
        title: parsed.title,
        description: parsed.metaDescription,
        wordCount: parsed.wordCount,
        siteContext: pageData.siteContext,
        hasLlmsTxt,
        hasSitemap: sitemapResult.exists, // Keep for backward compat
        sitemapUrls: sitemapResult.urlCount, // Keep for backward compat
        aiCrawlersBlocked, // Keep for backward compat
        schemaTypes: parsed.schemaTypes,
        ogTags: parsed.ogTags,
      },
      visibility,
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

  const project = await projectQueries(db).getById(crawlJob.projectId);
  if (!project) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const job: GenerateReportJob = {
    reportId: crawlJob.id,
    projectId: project.id,
    crawlJobId: crawlJob.id,
    userId: project.userId,
    type: "detailed",
    format: "pdf",
    config: {} as ReportConfig,
  };

  const raw = await fetchReportData(db, job);
  const aggregated = aggregateReportData(raw, { type: "detailed" });

  // Filter data based on share level
  const level = (crawlJob.shareLevel as string) || "summary";
  const quickWins = level === "summary" ? [] : aggregated.quickWins.slice(0, 5);

  c.header("Cache-Control", "public, max-age=3600");
  return c.json({
    data: {
      crawlId: crawlJob.id,
      projectId: project.id,
      completedAt: crawlJob.completedAt,
      pagesScored: crawlJob.pagesScored,
      pagesCrawled: crawlJob.pagesCrawled,
      summary: crawlJob.summary,
      summaryData: crawlJob.summaryData ?? null,
      shareLevel: level,
      project: {
        name: project.name,
        domain: project.domain,
        branding: (project.branding as any) ?? null,
      },
      scores: {
        overall: aggregated.scores.overall,
        technical: aggregated.scores.technical,
        content: aggregated.scores.content,
        aiReadiness: aggregated.scores.aiReadiness,
        performance: aggregated.scores.performance,
        letterGrade: aggregated.scores.letterGrade,
      },
      pages:
        level === "summary"
          ? []
          : aggregated.pages.map((p) => ({
              url: p.url,
              title: p.title,
              overallScore: p.overall,
              technicalScore: p.technical,
              contentScore: p.content,
              aiReadinessScore: p.aiReadiness,
              issueCount: p.issueCount,
            })),
      issueCount: aggregated.issues.total,
      readinessCoverage: aggregated.readinessCoverage,
      scoreDeltas: level === "full" ? aggregated.scoreDeltas : null,
      quickWins: quickWins.map((win) => ({
        code: win.code,
        category: win.category,
        severity: win.severity,
        scoreImpact: win.scoreImpact,
        effortLevel: win.effort,
        effort: win.effort,
        message: win.message,
        recommendation: win.recommendation,
        priority: win.scoreImpact,
        affectedPages: win.affectedPages,
        owner: win.owner,
        pillar: win.pillar,
        docsUrl: win.docsUrl,
      })),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/public/scan-results/:id — Retrieve scan result (gated/unlocked)
// ---------------------------------------------------------------------------

publicRoutes.get("/scan-results/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const unlockToken = c.req.query("token");

  const result = await scanResultQueries(db).getById(id);
  if (!result) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Scan result not found" } },
      404,
    );
  }

  // Check if email was captured (token = lead ID)
  // Validate that the lead's scanResultId matches the requested scan result
  let isUnlocked = false;
  if (unlockToken) {
    const lead = await leadQueries(db).getById(unlockToken);
    isUnlocked = !!lead && lead.scanResultId === id;
  }

  if (isUnlocked) {
    return c.json({ data: result }); // Full results
  }

  // Partial results (gated)
  return c.json({
    data: {
      id: result.id,
      domain: result.domain,
      url: result.url,
      scores: result.scores,
      issues: (result.issues as any[]).slice(0, 3),
      siteContext: (result as any).siteContext,
      // quickWins omitted for gated view
      createdAt: result.createdAt,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/public/leads — Capture email from public report page
// ---------------------------------------------------------------------------

publicRoutes.post("/leads", async (c) => {
  const db = c.get("db");
  const body = await c.req.json<{
    email: string;
    reportToken?: string;
    source?: string;
    scanResultId?: string;
  }>();

  if (
    !body.email ||
    typeof body.email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
  ) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "A valid email address is required",
        },
      },
      422,
    );
  }

  const lead = await leadQueries(db).create({
    email: body.email,
    reportToken: body.reportToken,
    source: body.source ?? "shared_report",
    scanResultId: body.scanResultId,
  });

  return c.json({ data: { id: lead.id } }, 201);
});
