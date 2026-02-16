import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry";
import { LLM_MODELS } from "./llm-config";

export interface ExtractedFact {
  type: "metric" | "definition" | "claim" | "quote";
  content: string;
  sourceSentence: string;
  citabilityScore: number;
}

export class FactExtractor {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = LLM_MODELS.factExtraction) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  /**
   * Extracts facts, metrics, and citable quotes from raw text.
   */
  async extractFacts(text: string): Promise<ExtractedFact[]> {
    const prompt = `You are an expert content analyst. Extract the most important "facts" from the following text that an AI assistant (like ChatGPT) would likely use to answer a user's question.

## Content
${text.slice(0, 15000)}

## Requirements
Extract up to 10 key items. For each, provide:
1. Type: 'metric' (numbers/specs), 'definition' (explanations), 'claim' (unique selling points), or 'quote' (highly punchy citable sentences).
2. Content: The distilled fact.
3. Source Sentence: The exact sentence from the text.
4. Citability Score: 0-100 (how likely an LLM is to use this exact sentence in a response).

## Format
Return ONLY a JSON array of objects:
[
  { "type": "metric", "content": "$29/mo", "sourceSentence": "Our pro plan costs $29/mo.", "citabilityScore": 95 }
]`;

    const response = await withRetry(() =>
      this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    );

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";
    try {
      const cleaned = content.replace(/```json|```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (_err) {
      console.error("Failed to parse facts:", content);
      return [];
    }
  }
}
