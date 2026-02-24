import Anthropic from "@anthropic-ai/sdk";
import { analyzeResponse, type VisibilityCheckResult } from "../visibility";
import { withRetry, withTimeout } from "../retry";
import { LLM_MODELS } from "../llm-config";

const REQUEST_TIMEOUT_MS = 30_000;

export async function checkClaude(
  query: string,
  targetDomain: string,
  competitors: string[],
  apiKey: string,
  locale?: { region: string; language: string },
): Promise<VisibilityCheckResult> {
  const client = new Anthropic({ apiKey });

  const systemPrompt =
    locale && (locale.region !== "us" || locale.language !== "en")
      ? `Answer as if you are responding to a user in ${locale.region.toUpperCase()} who speaks ${locale.language}.`
      : undefined;

  const response = await withRetry(() =>
    withTimeout(
      client.messages.create({
        model: LLM_MODELS.visibility.claude,
        max_tokens: 1024,
        ...(systemPrompt && { system: systemPrompt }),
        messages: [{ role: "user", content: query }],
      }),
      REQUEST_TIMEOUT_MS,
    ),
  );

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const analysis = analyzeResponse(responseText, targetDomain, competitors);

  return {
    provider: "claude",
    query,
    responseText,
    ...analysis,
  };
}
