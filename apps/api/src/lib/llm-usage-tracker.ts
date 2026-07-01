import { llmUsageQueries } from "@llm-boost/db";
import { estimateCostUsd } from "@llm-boost/llm";

/**
 * Best-effort LLM cost recorder (admin spend view). Computes cost from token
 * usage + records one `llm_usage` row. NEVER throws — a tracking failure must
 * not break the feature it's measuring. Call after any Anthropic response with
 * a `.usage` block.
 */
export async function trackLlmUsage(
  db: Parameters<typeof llmUsageQueries>[0],
  args: {
    feature: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    userId?: string | null;
    projectId?: string | null;
    plan?: string | null;
    batch?: boolean;
  },
): Promise<void> {
  try {
    await llmUsageQueries(db).record({
      feature: args.feature,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      costUsd: estimateCostUsd(
        args.model,
        args.inputTokens,
        args.outputTokens,
        {
          batch: args.batch,
        },
      ),
      userId: args.userId ?? null,
      projectId: args.projectId ?? null,
      plan: args.plan ?? null,
    });
  } catch (err) {
    console.error("[llm-usage] track failed:", err);
  }
}
