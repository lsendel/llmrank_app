import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry";
import { LLM_MODELS } from "./llm-config";

export interface SentimentResult {
  sentiment: "positive" | "neutral" | "negative";
  brandDescription: string | null;
  attributes: string[];
}

/**
 * Analyzes brand sentiment from an AI platform's response text.
 * Uses Claude Haiku for cost efficiency (~$0.001/call).
 */
export async function analyzeBrandSentiment(
  apiKey: string,
  responseText: string,
  brandDomain: string,
): Promise<SentimentResult> {
  const brandName = brandDomain
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .replace(/\/$/, "")
    .split(".")[0];

  const client = new Anthropic({ apiKey });

  const response = await withRetry(() =>
    client.messages.create({
      model: LLM_MODELS.sentiment,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Analyze how this AI response describes the brand "${brandName}" (${brandDomain}).

Response text:
"""
${responseText.slice(0, 2000)}
"""

Return JSON only, no other text:
{
  "sentiment": "positive" | "neutral" | "negative",
  "brandDescription": "one sentence summary of how the brand is described, or null if not meaningfully described",
  "attributes": ["up to 5 key attributes or qualities mentioned about the brand"]
}`,
        },
      ],
    }),
  );

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { sentiment: "neutral", brandDescription: null, attributes: [] };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      sentiment: ["positive", "neutral", "negative"].includes(parsed.sentiment)
        ? parsed.sentiment
        : "neutral",
      brandDescription: parsed.brandDescription || null,
      attributes: Array.isArray(parsed.attributes)
        ? parsed.attributes.slice(0, 5)
        : [],
    };
  } catch {
    return { sentiment: "neutral", brandDescription: null, attributes: [] };
  }
}
