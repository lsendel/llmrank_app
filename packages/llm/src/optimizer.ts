import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry";

export interface OptimizationResult {
  original: string;
  optimized: string;
  explanation: string;
}

export interface ContentBrief {
  keyword: string;
  wordCount: string;
  headings: string[];
  secondaryKeywords: string[];
  lsiKeywords: string[];
  searchIntent: string;
}

function stripFences(text: string): string {
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

export class StrategyOptimizer {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model ?? "claude-3-5-sonnet-20240620";
  }

  /**
   * Rewrites content to maximize AI visibility based on research-backed prompts.
   */
  async rewriteForAIVisibility(content: string): Promise<OptimizationResult> {
    const prompt = `Rewrite this content to maximize visibility in AI-generated search results (Google AI Overviews, ChatGPT, Perplexity):

[CONTENT]
${content}

## Focus Areas
- Clear, direct answers to likely queries.
- Comprehensive coverage with related terms.
- Natural question-answer format where appropriate.
- Exact terminology matching.
- Structured, scannable format.

## Instructions
Return a JSON object with:
1. "optimized": The rewritten content.
2. "explanation": A 1-sentence summary of what was improved.

Return only the JSON.`;

    const response = await withRetry(() =>
      this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    );

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    return JSON.parse(stripFences(text));
  }

  /**
   * Generates a comprehensive SEO content brief.
   */
  async generateContentBrief(keyword: string): Promise<ContentBrief> {
    const prompt = `Create a detailed content brief for a blog post targeting the keyword "${keyword}".

Requirements:
- Target word count: 2000-2500 words.
- Include exactly 5 H2 headings.
- List 1 primary keyword and 3-5 secondary keywords.
- Suggest 3-5 LSI keywords to integrate naturally.
- Outline user search intent.

## Format
Return ONLY a JSON object matching the structure:
{
  "keyword": "string",
  "wordCount": "string",
  "headings": ["string"],
  "secondaryKeywords": ["string"],
  "lsiKeywords": ["string"],
  "searchIntent": "string"
}

    Return only the JSON.`;

    const response = await withRetry(() =>
      this.client.messages.create({
        model: this.model,
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    );

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    return JSON.parse(stripFences(text));
  }

  /**
   * Compares user content structure against a competitor to find structural gaps.
   */
  async analyzeStructuralGap(data: {
    userDomain: string;
    competitorDomain: string;
    userStructure: Record<string, unknown>;
    query: string;
  }): Promise<{ missingElements: string[]; recommendation: string }> {
    const prompt = `Conduct a structural gap analysis for AI Search visibility.
A competitor (${data.competitorDomain}) is being cited by AI assistants for the query "${data.query}", while our domain (${data.userDomain}) is not.

## Our Current Page Structure
${JSON.stringify(data.userStructure, null, 2)}

## Goal
Identify what structural or content elements the competitor likely has that we are missing. Focus on "Citation Magnets" like tables, specific schema types, or direct answer formats.

## Format
Return a JSON object:
{
  "missingElements": ["e.g., FAQ Schema", "e.g., Comparison Table"],
  "recommendation": "A 2-sentence actionable instruction on how to beat this competitor."
}

Return only the JSON.`;

    const response = await withRetry(() =>
      this.client.messages.create({
        model: this.model,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    );

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    return JSON.parse(stripFences(text));
  }

  /**
   * Generates a specific content snippet to fix a semantic or structural gap.
   */
  async generateContentFix(data: {
    currentContent: string;
    missingFact: string;
    factType: string;
    tone?: string;
  }): Promise<{
    suggestedSnippet: string;
    placementAdvice: string;
    citabilityBoost: number;
  }> {
    const prompt = `You are an expert AI SEO Copywriter. 
Your goal is to write a short, high-density content snippet that incorporates a missing fact into an existing page to improve LLM citability.

## Context
Current Page Excerpt: "${data.currentContent.slice(0, 1000)}"
Missing Fact to Include: "${data.missingFact}" (Type: ${data.factType})
Desired Tone: ${data.tone || "Professional and Authoritative"}

## Requirements
1. Write a 1-2 paragraph snippet that naturally includes the missing fact.
2. Ensure the sentence containing the fact is "punchy" and easy for an AI (like ChatGPT) to extract as a direct answer.
3. Use active voice.

## Format
Return ONLY a JSON object:
{
  "suggestedSnippet": "The new content...",
  "placementAdvice": "e.g., Replace the second paragraph of your 'About' section.",
  "citabilityBoost": 25
}

    Return only the JSON.`;

    const response = await withRetry(() =>
      this.client.messages.create({
        model: this.model,

        max_tokens: 1000,

        messages: [{ role: "user", content: prompt }],
      }),
    );

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return JSON.parse(stripFences(text));
  }

  /**

   * Improves a specific dimension of content quality.

   */

  async improveDimension(data: {
    content: string;

    dimension:
      | "clarity"
      | "authority"
      | "comprehensiveness"
      | "structure"
      | "citation_worthiness";

    tone?: string;
  }): Promise<OptimizationResult> {
    const rubrics = {
      clarity:
        "Simplify sentence structures, use active voice, and improve the logical flow. Focus on making it easy to understand.",

      authority:
        "Incorporate expert terminology, suggest places for data/citations (use [PLACEHOLDER] for data), and demonstrate deep domain expertise.",

      comprehensiveness:
        "Add sub-topics, address common user questions, and ensure all key aspects of the topic are covered thoroughly.",

      structure:
        "Improve heading hierarchy (H2/H3), use bullet points/lists where appropriate, and ensure the content is easily scannable.",

      citation_worthiness:
        "Refine content into punchy, definitive statements that are easy for AI assistants to extract as direct answers. Add unique insights.",
    };

    const prompt = `You are an expert AI SEO Copywriter. Your goal is to rewrite the following content to improve its "${
      data.dimension
    }" score for AI search engines.



## Instructions for ${data.dimension}:

${rubrics[data.dimension]}



## Tone

${data.tone || "Maintain the existing tone of the content."}



## Content to Improve:

${data.content}



## Output Format

Return a JSON object with:

1. "optimized": The rewritten content.

2. "explanation": A 1-sentence summary of what was specifically changed to improve the ${
      data.dimension
    } score.



Return only the JSON.`;

    const response = await withRetry(() =>
      this.client.messages.create({
        model: this.model,

        max_tokens: 4000,

        messages: [{ role: "user", content: prompt }],
      }),
    );

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return JSON.parse(stripFences(text));
  }
}
