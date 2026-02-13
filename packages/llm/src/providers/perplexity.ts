import OpenAI from "openai";
import { analyzeResponse, type VisibilityCheckResult } from "../visibility";

export async function checkPerplexity(
  query: string,
  targetDomain: string,
  competitors: string[],
  apiKey: string,
): Promise<VisibilityCheckResult> {
  // Perplexity uses an OpenAI-compatible API
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.perplexity.ai",
  });

  const response = await client.chat.completions.create({
    model: "llama-3.1-sonar-small-128k-online",
    messages: [{ role: "user", content: query }],
    max_tokens: 1024,
  });

  const responseText = response.choices[0]?.message?.content ?? "";
  const analysis = analyzeResponse(responseText, targetDomain, competitors);

  return {
    provider: "perplexity",
    query,
    responseText,
    ...analysis,
  };
}
