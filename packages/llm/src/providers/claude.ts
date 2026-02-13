import Anthropic from "@anthropic-ai/sdk";
import { analyzeResponse, type VisibilityCheckResult } from "../visibility";

export async function checkClaude(
  query: string,
  targetDomain: string,
  competitors: string[],
  apiKey: string,
): Promise<VisibilityCheckResult> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [{ role: "user", content: query }],
  });

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
