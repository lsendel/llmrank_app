import Anthropic from "@anthropic-ai/sdk";
import { LLM_MODELS } from "./llm-config";

export async function suggestKeywords(
  apiKey: string,
  domain: string,
  contextKeywords: string,
): Promise<string[]> {
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: LLM_MODELS.scoring, // Haiku — cheap
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are an SEO keyword research assistant.

Domain: ${domain}
Existing top keywords: ${contextKeywords || "none available"}

Suggest 20 search queries a user might ask an AI assistant (ChatGPT, Claude, Perplexity) where ${domain} should be a cited source. Focus on the site's expertise areas.

Return ONLY a JSON array of strings, no explanation. Example: ["keyword 1", "keyword 2"]`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  try {
    // Extract JSON array from response (may have markdown code block wrapper)
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item: unknown) => typeof item === "string")
      .slice(0, 20);
  } catch {
    return [];
  }
}
