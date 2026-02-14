import { Hono } from "hono";
import type { AppEnv } from "../index";
import { hmacMiddleware } from "../middleware/hmac";
import {
  createCrawlRepository,
  createPageRepository,
  createScoreRepository,
  createOutboxRepository,
} from "../repositories";
import { createIngestService } from "../services/ingest-service";
import { handleServiceError } from "../services/errors";

export const ingestRoutes = new Hono<AppEnv>();

// All ingest routes require HMAC verification
ingestRoutes.use("*", hmacMiddleware);

// ---------------------------------------------------------------------------
// POST /batch — Receive crawl results from the Hetzner crawler
// ---------------------------------------------------------------------------

ingestRoutes.post("/batch", async (c) => {
  const service = createIngestService({
    crawls: createCrawlRepository(c.get("db")),
    pages: createPageRepository(c.get("db")),
    scores: createScoreRepository(c.get("db")),
    outbox: createOutboxRepository(c.get("db")),
  });

  const stored = c.get("parsedBody" as never) as string | undefined;
  const rawBody = stored ?? (await c.req.text());

  try {
    const data = await service.processBatch({
      rawBody,
      env: {
        databaseUrl: c.env.DATABASE_URL,
        anthropicApiKey: c.env.ANTHROPIC_API_KEY,
        kvNamespace: c.env.KV,
        seenUrls: c.env.SEEN_URLS,
        queue: c.env.CRAWL_QUEUE,
        r2: c.env.R2,
        integrationKey: c.env.INTEGRATION_ENCRYPTION_KEY,
        googleClientId: c.env.GOOGLE_OAUTH_CLIENT_ID,
        googleClientSecret: c.env.GOOGLE_OAUTH_CLIENT_SECRET,
      },
      executionCtx: c.executionCtx,
    });
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// POST /rescore-llm — Re-run LLM content scoring on an existing crawl job
// ---------------------------------------------------------------------------

ingestRoutes.post("/rescore-llm", async (c) => {
  const service = createIngestService({
    crawls: createCrawlRepository(c.get("db")),
    pages: createPageRepository(c.get("db")),
    scores: createScoreRepository(c.get("db")),
    outbox: createOutboxRepository(c.get("db")),
  });
  const { job_id } = await c.req.json<{ job_id: string }>();

  try {
    const result = await service.rescoreLLMJob({
      jobId: job_id,
      env: {
        databaseUrl: c.env.DATABASE_URL,
        anthropicApiKey: c.env.ANTHROPIC_API_KEY,
        kvNamespace: c.env.KV,
        r2: c.env.R2,
      },
    });
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
