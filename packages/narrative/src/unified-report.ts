import Anthropic from "@anthropic-ai/sdk";
import type { TokenUsage } from "./types";

// Inline type to avoid pulling in @llm-boost/reports (which has JSX deps)
interface UnifiedReportData {
  project: { domain: string };
  scores: {
    overall: number;
    letterGrade: string;
    technical: number;
    content: number;
    aiReadiness: number;
    performance?: number;
  };
  issues: {
    items: Array<{
      severity: string;
      message: string;
      affectedPages: number;
      scoreImpact: number;
    }>;
  };
  quickWins: Array<{
    message: string;
    recommendation: string;
    effort: string;
    scoreImpact: number;
  }>;
  visibility?: {
    platforms: Array<{
      provider: string;
      brandMentionRate: number;
      urlCitationRate: number;
    }>;
  };
  competitors?: Array<{
    domain: string;
    mentionCount: number;
    platforms: string[];
  }>;
  structuredDataAnalysis?: {
    foundTypes: string[];
    missingRecommendedTypes: string[];
  };
  aiCrawlerStatus?: Array<{ bot: string; allowed: boolean }>;
}
import { UNIFIED_REPORT_PROMPT } from "./prompts/section-prompts";
import { calculateCost } from "./utils/token-tracker";

const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface UnifiedReportResult {
  content: string;
  tokenUsage: TokenUsage;
  generatedBy: string;
}

export class UnifiedReportGenerator {
  private client: Anthropic;
  private model: string;

  constructor(options: { anthropicApiKey: string; model?: string }) {
    this.client = new Anthropic({ apiKey: options.anthropicApiKey });
    this.model = options.model ?? DEFAULT_MODEL;
  }

  async generate(data: UnifiedReportData): Promise<UnifiedReportResult> {
    const variables = this.buildTemplateVariables(data);
    const userPrompt = this.interpolate(UNIFIED_REPORT_PROMPT.user, variables);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: UNIFIED_REPORT_PROMPT.system,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    return {
      content,
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
        costCents: calculateCost(this.model, inputTokens, outputTokens),
      },
      generatedBy: this.model,
    };
  }

  private buildTemplateVariables(
    data: UnifiedReportData,
  ): Record<string, string> {
    const { scores, issues, quickWins, visibility, competitors } = data;

    const topIssues = issues.items
      .slice(0, 10)
      .map(
        (i) =>
          `- [${i.severity.toUpperCase()}] ${i.message} (${i.affectedPages} pages, -${i.scoreImpact} pts)`,
      )
      .join("\n");

    const structuredDataFound =
      data.structuredDataAnalysis?.foundTypes.join(", ") || "None detected";
    const structuredDataMissing =
      data.structuredDataAnalysis?.missingRecommendedTypes.join(", ") ||
      "Unable to determine";

    const crawlerStatus =
      data.aiCrawlerStatus
        ?.map((c) => `${c.bot}: ${c.allowed ? "Allowed" : "Blocked"}`)
        .join(", ") || "Not checked";

    const visibilityResults = visibility
      ? visibility.platforms
          .map(
            (p) =>
              `${p.provider}: ${p.brandMentionRate}% mention rate, ${p.urlCitationRate}% citation rate`,
          )
          .join("; ")
      : "No visibility data available";

    const competitorAnalysis = competitors
      ? competitors
          .map(
            (c) =>
              `${c.domain}: mentioned ${c.mentionCount}x on ${c.platforms.join(", ")}`,
          )
          .join("; ")
      : "No competitors tracked";

    const quickWinsList = quickWins
      .slice(0, 5)
      .map(
        (q) =>
          `- ${q.message}: ${q.recommendation} (effort: ${q.effort}, impact: +${q.scoreImpact} pts)`,
      )
      .join("\n");

    return {
      domain: data.project.domain,
      overallScore: String(scores.overall),
      grade: scores.letterGrade,
      technicalScore: String(scores.technical),
      contentScore: String(scores.content),
      aiReadinessScore: String(scores.aiReadiness),
      performanceScore: String(scores.performance ?? "N/A"),
      topIssues: topIssues || "No issues found",
      structuredDataFound,
      structuredDataMissing,
      crawlerStatus,
      visibilityResults,
      competitorAnalysis,
      quickWins: quickWinsList || "No quick wins identified",
    };
  }

  private interpolate(
    template: string,
    variables: Record<string, string>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
  }
}
