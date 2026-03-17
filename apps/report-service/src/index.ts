import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { createDb, reports, eq } from "@llm-boost/db";
import { renderPdf, renderDocx, aggregateReportData } from "@llm-boost/reports";
import type { GenerateReportJob } from "@llm-boost/reports";
import { fetchReportData } from "./data-fetcher";

// ---------------------------------------------------------------------------
// Config from environment
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? "8080", 10);
const DATABASE_URL = process.env.DATABASE_URL!;
const SHARED_SECRET = process.env.SHARED_SECRET!;
const API_BASE_URL = process.env.API_BASE_URL!; // e.g. https://api.llmrank.app

// ---------------------------------------------------------------------------
// HMAC signing (for uploading back to API worker)
// ---------------------------------------------------------------------------

async function signUploadHeaders(
  reportId: string,
  r2Key: string,
): Promise<{ signature: string; timestamp: string }> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${timestamp}${reportId}${r2Key}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SHARED_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { signature: `hmac-sha256=${hex}`, timestamp };
}

// ---------------------------------------------------------------------------
// Upload to R2 via API worker relay
// ---------------------------------------------------------------------------

async function uploadViaApi(
  reportId: string,
  r2Key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  const { signature, timestamp } = await signUploadHeaders(reportId, r2Key);

  const res = await fetch(`${API_BASE_URL}/internal/report-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Signature": signature,
      "X-Timestamp": timestamp,
      "X-Report-Id": reportId,
      "X-R2-Key": r2Key,
      "X-Content-Type": contentType,
    },
    body: Buffer.from(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API upload failed (${res.status}): ${text}`);
  }
}

// ---------------------------------------------------------------------------
// HMAC verification (for incoming job requests)
// ---------------------------------------------------------------------------

const MAX_TIMESTAMP_DRIFT_S = 300; // 5 minutes

async function verifyHmac(
  signature: string,
  timestamp: string,
  body: string,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > MAX_TIMESTAMP_DRIFT_S) return false;

  const prefix = "hmac-sha256=";
  if (!signature.startsWith(prefix)) return false;
  const providedHex = signature.slice(prefix.length);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SHARED_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}${body}`),
  );
  const expectedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return providedHex === expectedHex;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Hono();

app.use("*", logger());

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Generate report
app.post("/generate", async (c) => {
  const signature = c.req.header("X-Signature");
  const timestamp = c.req.header("X-Timestamp");
  const body = await c.req.text();

  if (!signature || !timestamp) {
    return c.json({ error: "Missing auth headers" }, 401);
  }

  const valid = await verifyHmac(signature, timestamp, body);
  if (!valid) {
    return c.json({ error: "Invalid HMAC signature" }, 401);
  }

  const job: GenerateReportJob = JSON.parse(body);
  const db = createDb(DATABASE_URL);

  // Respond immediately — process in the background
  // (Fly.io keeps the process alive, unlike CF Workers)
  const responsePromise = (async () => {
    try {
      // Update status to generating
      await db
        .update(reports)
        .set({ status: "generating" })
        .where(eq(reports.id, job.reportId));

      // Fetch all data from DB
      const rawData = await fetchReportData(db, job);

      // Aggregate into report structure
      const reportData = aggregateReportData(rawData, {
        type: job.type,
        config: job.config,
        isPublic: job.isPublic,
      });

      // Render document
      const buffer =
        job.format === "pdf"
          ? await renderPdf(reportData, job.type)
          : await renderDocx(reportData, job.type);

      // Upload to R2 via API worker relay
      const r2Key = `reports/${job.projectId}/${job.reportId}.${job.format}`;
      const contentType =
        job.format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      await uploadViaApi(job.reportId, r2Key, buffer, contentType);

      console.log(`Report ${job.reportId} generated successfully (${r2Key})`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Report ${job.reportId} failed:`, errorMsg);

      await db
        .update(reports)
        .set({ status: "failed", error: errorMsg })
        .where(eq(reports.id, job.reportId));
    }
  })();

  // Don't await — respond 202 Accepted immediately
  responsePromise.catch((e) => console.error("Background task error:", e));

  return c.json({ accepted: true, reportId: job.reportId }, 202);
});

// ---------------------------------------------------------------------------
// Pipeline runner — executes auto-generation steps without Worker time limits
// ---------------------------------------------------------------------------

interface PipelineJob {
  runId: string;
  projectId: string;
  crawlJobId: string;
  keys: {
    anthropicApiKey: string;
    perplexityApiKey?: string;
    grokApiKey?: string;
  };
  skipSteps?: string[];
}

const PIPELINE_STEPS = [
  "site_description",
  "personas",
  "keywords",
  "competitors",
  "visibility_check",
  "content_optimization",
  "action_report",
  "health_check",
] as const;

async function executePipeline(job: PipelineJob): Promise<void> {
  const db = createDb(DATABASE_URL);
  const { pipelineRunQueries } = await import("@llm-boost/db");
  const runs = pipelineRunQueries(db);
  const skipSteps = new Set(job.skipSteps ?? []);

  await runs.updateStatus(job.runId, "running", { startedAt: new Date() });

  for (const step of PIPELINE_STEPS) {
    if (skipSteps.has(step)) {
      await runs.updateStep(job.runId, step, { status: "skipped" });
      continue;
    }

    await runs.updateStatus(job.runId, "running", { currentStep: step });
    const start = Date.now();
    let stepOutput: Record<string, unknown> = {};

    try {
      switch (step) {
        case "site_description": {
          const { runAutoSiteDescription } = await import("./pipeline-steps");
          await runAutoSiteDescription({
            databaseUrl: DATABASE_URL,
            projectId: job.projectId,
            crawlJobId: job.crawlJobId,
            anthropicApiKey: job.keys.anthropicApiKey,
          });
          break;
        }
        case "personas": {
          const { runAutoPersonaGeneration } = await import("./pipeline-steps");
          await runAutoPersonaGeneration({
            databaseUrl: DATABASE_URL,
            projectId: job.projectId,
            anthropicApiKey: job.keys.anthropicApiKey,
          });
          break;
        }
        case "keywords": {
          const { runAutoKeywordGeneration } = await import("./pipeline-steps");
          await runAutoKeywordGeneration({
            databaseUrl: DATABASE_URL,
            projectId: job.projectId,
            crawlJobId: job.crawlJobId,
            anthropicApiKey: job.keys.anthropicApiKey,
          });
          break;
        }
        case "competitors": {
          const { runAutoCompetitorDiscovery } =
            await import("./pipeline-steps");
          await runAutoCompetitorDiscovery({
            databaseUrl: DATABASE_URL,
            projectId: job.projectId,
            anthropicApiKey: job.keys.anthropicApiKey,
            perplexityApiKey: job.keys.perplexityApiKey,
            grokApiKey: job.keys.grokApiKey,
          });
          break;
        }
        case "visibility_check": {
          const { runAutoVisibilityChecks } = await import("./pipeline-steps");
          await runAutoVisibilityChecks({
            databaseUrl: DATABASE_URL,
            projectId: job.projectId,
            apiKeys: {
              anthropicApiKey: job.keys.anthropicApiKey,
              perplexityApiKey: job.keys.perplexityApiKey ?? "",
              grokApiKey: job.keys.grokApiKey ?? "",
            },
          });
          break;
        }
        case "content_optimization": {
          const { runContentOptimization } = await import("./pipeline-steps");
          const result = await runContentOptimization({
            databaseUrl: DATABASE_URL,
            projectId: job.projectId,
            crawlJobId: job.crawlJobId,
            anthropicApiKey: job.keys.anthropicApiKey,
          });
          stepOutput = {
            pagesAnalyzed: result.pagesAnalyzed,
            suggestionsGenerated: result.suggestions.length,
          };
          break;
        }
        case "action_report": {
          const { createRecommendationsService } =
            await import("./pipeline-steps");
          const recommendations = await createRecommendationsService(
            db,
          ).getForProject(job.projectId);
          stepOutput = {
            actionsGenerated: recommendations.length,
            criticalActions: recommendations.filter(
              (r: { priority: string }) => r.priority === "critical",
            ).length,
            highActions: recommendations.filter(
              (r: { priority: string }) => r.priority === "high",
            ).length,
          };
          break;
        }
        case "health_check": {
          const { runHealthCheck } = await import("./pipeline-steps");
          const result = await runHealthCheck({
            databaseUrl: DATABASE_URL,
            projectId: job.projectId,
            crawlJobId: job.crawlJobId,
          });
          stepOutput = {
            healthScore: result.score,
            checksRun: result.checks.length,
            failedChecks: result.checks.filter(
              (c: { status: string }) => c.status === "fail",
            ).length,
            warningChecks: result.checks.filter(
              (c: { status: string }) => c.status === "warn",
            ).length,
          };
          break;
        }
      }

      await runs.updateStep(job.runId, step, {
        status: "completed",
        duration_ms: Date.now() - start,
        ...stepOutput,
      });
      console.log(
        `Pipeline ${job.runId}: step ${step} completed (${Date.now() - start}ms)`,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`Pipeline ${job.runId}: step ${step} failed:`, errorMsg);
      await runs.updateStep(job.runId, step, {
        status: "failed",
        duration_ms: Date.now() - start,
        error: errorMsg,
      });
    }
  }

  await runs.updateStatus(job.runId, "completed", {
    currentStep: null,
    completedAt: new Date(),
  });
  console.log(`Pipeline ${job.runId} completed`);
}

app.post("/pipeline/run", async (c) => {
  const signature = c.req.header("X-Signature");
  const timestamp = c.req.header("X-Timestamp");
  const body = await c.req.text();

  if (!signature || !timestamp) {
    return c.json({ error: "Missing auth headers" }, 401);
  }

  const valid = await verifyHmac(signature, timestamp, body);
  if (!valid) {
    return c.json({ error: "Invalid HMAC signature" }, 401);
  }

  const job: PipelineJob = JSON.parse(body);

  // Run in background — respond 202 immediately
  executePipeline(job).catch((e) => {
    console.error(`Pipeline ${job.runId} uncaught error:`, e);
    const db = createDb(DATABASE_URL);
    import("@llm-boost/db").then(({ pipelineRunQueries }) => {
      pipelineRunQueries(db)
        .updateStatus(job.runId, "failed", {
          completedAt: new Date(),
          error: e instanceof Error ? e.message : String(e),
        })
        .catch(console.error);
    });
  });

  return c.json({ accepted: true, runId: job.runId }, 202);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

console.log(`Report service starting on port ${PORT}`);
serve({ fetch: app.fetch, port: PORT });
