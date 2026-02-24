import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry";
import { LLM_MODELS } from "./llm-config";

export interface DiscoveredPrompt {
  prompt: string;
  category: "comparison" | "how-to" | "recommendation" | "review" | "general";
  estimatedVolume: number;
  difficulty: number;
  intent: "informational" | "transactional" | "navigational";
}

/**
 * Uses Claude Sonnet to discover realistic AI prompts people would ask
 * about a given industry/domain. Returns up to `count` prompts with
 * estimated volume and difficulty scores.
 */
export async function discoverPrompts(
  apiKey: string,
  options: {
    domain: string;
    industry: string;
    siteDescription: string;
    existingKeywords: string[];
    competitors: string[];
    count?: number;
  },
): Promise<DiscoveredPrompt[]> {
  const count = options.count ?? 20;
  const client = new Anthropic({ apiKey });

  const competitorList =
    options.competitors.length > 0
      ? `Known competitors: ${options.competitors.join(", ")}`
      : "No known competitors provided.";

  const keywordList =
    options.existingKeywords.length > 0
      ? `Existing tracked keywords: ${options.existingKeywords.slice(0, 20).join(", ")}`
      : "No existing keywords.";

  const response = await withRetry(() =>
    client.messages.create({
      model: LLM_MODELS.personas, // Sonnet — needs creative reasoning
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are an AI search expert. Generate ${count} realistic prompts/questions that real users would type into AI assistants (ChatGPT, Claude, Perplexity, Gemini) about the industry and topics related to this business.

Business domain: ${options.domain}
Industry: ${options.industry}
Description: ${options.siteDescription}
${competitorList}
${keywordList}

Generate diverse prompts across these categories:
- "comparison": "Best X vs Y", "Compare X and Y for Z"
- "how-to": "How to solve X with Y", "Step-by-step guide to Z"
- "recommendation": "Best tools for X", "What's the best X for Y"
- "review": "Is X good for Y?", "X review 2026", "X pros and cons"
- "general": Informational queries about the industry

For each prompt, estimate:
- estimatedVolume: monthly estimated asks (100-50000 range, be realistic)
- difficulty: 0-100 how hard it is to appear in AI responses (consider competition, specificity)
- intent: "informational", "transactional", or "navigational"

Return a JSON array only, no other text:
[
  {
    "prompt": "the actual prompt text",
    "category": "comparison|how-to|recommendation|review|general",
    "estimatedVolume": 1500,
    "difficulty": 45,
    "intent": "informational"
  }
]`,
        },
      ],
    }),
  );

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as unknown[];
    if (!Array.isArray(parsed)) return [];

    const validCategories = [
      "comparison",
      "how-to",
      "recommendation",
      "review",
      "general",
    ];
    const validIntents = ["informational", "transactional", "navigational"];

    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null && "prompt" in item,
      )
      .slice(0, count)
      .map((item) => ({
        prompt: String(item.prompt),
        category: validCategories.includes(String(item.category))
          ? (String(item.category) as DiscoveredPrompt["category"])
          : "general",
        estimatedVolume: Math.max(
          0,
          Math.min(100000, Number(item.estimatedVolume) || 0),
        ),
        difficulty: Math.max(0, Math.min(100, Number(item.difficulty) || 50)),
        intent: validIntents.includes(String(item.intent))
          ? (String(item.intent) as DiscoveredPrompt["intent"])
          : "informational",
      }));
  } catch {
    return [];
  }
}
