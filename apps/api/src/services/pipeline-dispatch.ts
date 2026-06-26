import { pipelineRunQueries } from "@llm-boost/db";
import { signPayload } from "../middleware/hmac";

type PipelineDb = Parameters<typeof pipelineRunQueries>[0];

export interface PipelineDispatchConfig {
  reportServiceUrl: string;
  sharedSecret: string;
  anthropicApiKey?: string;
  perplexityApiKey?: string;
  xaiApiKey?: string;
  skipSteps?: string[];
}

export interface PipelineDispatchResult {
  runId: string;
  status: "pending" | "failed";
  error?: string;
}

/**
 * Create a pipeline_run and dispatch it to the Fly report service. Shared by the
 * manual rerun endpoint (routes/projects.ts) and the automatic post-crawl trigger
 * (post-processing-service.ts) so both behave identically and record failures.
 *
 * Cold-start resilient: the report service auto-suspends (Fly scale-to-zero) and
 * can take >12s to wake, so a single dispatch fired the moment a crawl finishes
 * frequently hit a cold service and failed. We retry once after a short delay —
 * the first attempt wakes the machine, the retry lands on the warm service. Any
 * terminal failure is recorded on the run (status=failed + error) rather than
 * swallowed, so the cause is visible instead of a silent "PENDING forever".
 */
export async function dispatchInsightsPipeline(
  db: PipelineDb,
  projectId: string,
  crawlJobId: string,
  config: PipelineDispatchConfig,
): Promise<PipelineDispatchResult> {
  const runs = pipelineRunQueries(db);
  const run = await runs.create({
    projectId,
    crawlJobId,
    settings: config.skipSteps ? { skipSteps: config.skipSteps } : {},
  });

  const payload = JSON.stringify({
    runId: run.id,
    projectId,
    crawlJobId,
    keys: {
      anthropicApiKey: config.anthropicApiKey,
      perplexityApiKey: config.perplexityApiKey,
      grokApiKey: config.xaiApiKey,
    },
    skipSteps: config.skipSteps,
  });
  // Sign once; the retry reuses the same timestamp (well within the 5-min replay
  // window) so the warm-service attempt is still accepted.
  const { signature, timestamp } = await signPayload(
    config.sharedSecret,
    payload,
  );

  const url = `${config.reportServiceUrl}/pipeline/run`;
  const attemptDispatch = () =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signature,
        "X-Timestamp": timestamp,
      },
      body: payload,
    });

  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await attemptDispatch();
      if (res.ok) {
        return { runId: run.id, status: "pending" };
      }
      lastError = `HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
    } catch (err) {
      // First attempt may time out while the cold Fly machine boots.
      lastError = err instanceof Error ? err.message : String(err);
    }
    if (attempt === 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  await runs.updateStatus(run.id, "failed", {
    error: `Failed to dispatch pipeline: ${lastError}`.slice(0, 500),
    completedAt: new Date(),
  });
  return { runId: run.id, status: "failed", error: lastError };
}
