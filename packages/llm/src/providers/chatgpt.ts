import OpenAI from "openai";
import { analyzeResponse, type VisibilityCheckResult } from "../visibility";
import { withRetry, withTimeout } from "../retry";

const REQUEST_TIMEOUT_MS = 30_000;

export async function checkChatGPT(
  query: string,
  targetDomain: string,
  competitors: string[],
  apiKey: string,
): Promise<VisibilityCheckResult> {
  const client = new OpenAI({ apiKey });

  const response = await withRetry(() =>
    withTimeout(
      client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: query }],
        max_tokens: 1024,
      }),
      REQUEST_TIMEOUT_MS,
    ),
  );

  const responseText = response.choices[0]?.message?.content ?? "";
  const analysis = analyzeResponse(responseText, targetDomain, competitors);

  return {
    provider: "chatgpt",
    query,
    responseText,
    ...analysis,
  };
}
