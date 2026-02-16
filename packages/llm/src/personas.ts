import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry";
import { LLM_MODELS } from "./llm-config";

export interface UserPersona {
  name: string;
  role: string;
  demographics: string;
  goals: string[];
  painPoints: string[];
  typicalQueries: string[];
  idealContentFormat: string;
}

export interface PersonaGeneratorOptions {
  anthropicApiKey: string;
  model?: string;
}

export class PersonaGenerator {
  private client: Anthropic;
  private model: string;

  constructor(options: PersonaGeneratorOptions) {
    this.client = new Anthropic({ apiKey: options.anthropicApiKey });
    this.model = options.model ?? LLM_MODELS.personas;
  }

  /**
   * Generates detailed user personas based on a business description or domain.
   */
  async generatePersonas(data: {
    domain: string;
    description: string;
    niche: string;
  }): Promise<UserPersona[]> {
    const { domain, description, niche } = data;

    const prompt = `You are an expert product strategist and marketing researcher. 
Generate 3 distinct, high-fidelity user personas for a business in the following niche.

## Business Context
Domain: ${domain}
Description: ${description}
Niche: ${niche}

## Requirements
For each persona, include:
1. Name and Professional Role.
2. Demographics (Age, Location, Tech Savviness).
3. 3-5 Primary Goals.
4. 3-5 Key Pain Points related to this niche.
5. 3 Typical Search Queries they would type into an AI assistant (ChatGPT/Perplexity).
6. Their Ideal Content Format (e.g., "Deep-dive technical guides", "Quick comparison tables").

## Format
Return ONLY a JSON array of objects following this structure:
[
  {
    "name": "string",
    "role": "string",
    "demographics": "string",
    "goals": ["string"],
    "painPoints": ["string"],
    "typicalQueries": ["string"],
    "idealContentFormat": "string"
  }
]

Return only the JSON, no explanation or markdown fences.`;

    const response = await withRetry(() =>
      this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    );

    let text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();
    try {
      return JSON.parse(text.trim()) as UserPersona[];
    } catch (error) {
      console.error("Failed to parse persona JSON:", text);
      throw new Error(
        "Failed to generate personas. LLM output was invalid JSON.",
        { cause: error },
      );
    }
  }
}
