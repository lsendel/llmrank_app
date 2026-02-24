import OpenAI from "openai";
import { analyzeResponse, type VisibilityCheckResult } from "../visibility";
import { withRetry, withTimeout } from "../retry";

const REQUEST_TIMEOUT_MS = 30_000;

export async function checkGrok(
  query: string,
  targetDomain: string,
  competitors: string[],
  apiKey: string,
  locale?: { region: string; language: string },
): Promise<VisibilityCheckResult> {
  // xAI uses an OpenAI-compatible API
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1",
  });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (locale && (locale.region !== "us" || locale.language !== "en")) {
    messages.push({
      role: "system",
      content: `Answer as if you are responding to a user in ${locale.region.toUpperCase()} who speaks ${locale.language}.`,
    });
  }
  messages.push({ role: "user", content: query });

  const response = await withRetry(() =>
    withTimeout(
      client.chat.completions.create({
        model: "grok-3-fast",
        messages,
        max_tokens: 1024,
      }),
      REQUEST_TIMEOUT_MS,
    ),
  );

  const responseText = response.choices[0]?.message?.content ?? "";
  const analysis = analyzeResponse(responseText, targetDomain, competitors);

  return {
    provider: "grok",
    query,
    responseText,
    ...analysis,
  };
}
