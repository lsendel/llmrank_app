import Anthropic from "@anthropic-ai/sdk";
import type { QuickWin } from "@llm-boost/shared";
import { withRetry } from "./retry";
import { LLM_MODELS } from "./llm-config";

export interface SummaryGeneratorOptions {
  anthropicApiKey: string;
  model?: string;
}

export class SummaryGenerator {
  private client: Anthropic;
  private model: string;

  constructor(options: SummaryGeneratorOptions) {
    this.client = new Anthropic({ apiKey: options.anthropicApiKey });
    this.model = options.model ?? LLM_MODELS.summary;
  }

  /**
   * Generates a concise executive summary for a crawl report based on aggregate scores and top issues.
   */
  async generateExecutiveSummary(data: {
    projectName: string;
    domain: string;
    overallScore: number;
    categoryScores: {
      technical: number;
      content: number;
      aiReadiness: number;
      performance: number;
    };
    quickWins: QuickWin[];
    pagesScored: number;
  }): Promise<string> {
    const {
      projectName,
      domain,
      overallScore,
      categoryScores,
      quickWins,
      pagesScored,
    } = data;

    const quickWinsText = quickWins
      .map(
        (w, i) =>
          `${i + 1}. ${w.message} (Impact: ${w.scoreImpact}, Affected Pages: ${w.affectedPages})`,
      )
      .join("\n");

    const prompt = `You are an expert AI SEO consultant. Generate a concise, professional executive summary for a website's AI-readiness audit.

## Audit Context
Project: ${projectName} (${domain})
Overall Score: ${overallScore}/100
Pages Scored: ${pagesScored}

## Score Breakdown
- Technical SEO: ${categoryScores.technical}/100
- Content Quality: ${categoryScores.content}/100
- AI Readiness: ${categoryScores.aiReadiness}/100
- Performance: ${categoryScores.performance}/100

## Top Issues to Address
${quickWinsText}

## Instructions
1. Write a 2-3 sentence overview of the site's current AI-readiness.
2. Highlight the single most critical area for improvement.
3. Keep the tone professional, encouraging, and actionable.
4. Total length should be under 100 words.
5. Return ONLY the summary text, no headings or preamble.`;

    const response = await withRetry(() =>
      this.client.messages.create({
        model: this.model,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    );

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    return text.trim();
  }
}
