import OpenAI from "openai";
import { analyzeResponse, type VisibilityCheckResult } from "../visibility";

export async function checkChatGPT(
  query: string,
  targetDomain: string,
  competitors: string[],
  apiKey: string,
): Promise<VisibilityCheckResult> {
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: query }],
    max_tokens: 1024,
  });

  const responseText = response.choices[0]?.message?.content ?? "";
  const analysis = analyzeResponse(responseText, targetDomain, competitors);

  return {
    provider: "chatgpt",
    query,
    responseText,
    ...analysis,
  };
}
