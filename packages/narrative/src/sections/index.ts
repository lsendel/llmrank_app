import Anthropic from "@anthropic-ai/sdk";
import type { NarrativeSection, NarrativeSectionType } from "@llm-boost/shared";
import type { NarrativeInput, TokenUsage } from "../types";
import { BASE_SYSTEM_PROMPT } from "../prompts/base-prompt";
import { getToneAdapter } from "../prompts/tone-adapters";
import { SECTION_PROMPTS } from "../prompts/section-prompts";
import type { NarrativeResolvedPrompt } from "../prompts/runtime-prompts";
import { selectDataForSection } from "../utils/data-selector";
import { calculateCost } from "../utils/token-tracker";

interface SectionConfig {
  type: NarrativeSectionType;
  title: string;
  order: number;
  shouldGenerate: (input: NarrativeInput) => boolean;
}

const SECTION_CONFIGS: SectionConfig[] = [
  {
    type: "executive_summary",
    title: "Executive Summary",
    order: 0,
    shouldGenerate: () => true,
  },
  {
    type: "technical_analysis",
    title: "Technical SEO Analysis",
    order: 1,
    shouldGenerate: () => true,
  },
  {
    type: "content_analysis",
    title: "Content Quality Analysis",
    order: 2,
    shouldGenerate: () => true,
  },
  {
    type: "ai_readiness_analysis",
    title: "AI Readiness Analysis",
    order: 3,
    shouldGenerate: () => true,
  },
  {
    type: "performance_analysis",
    title: "Performance Analysis",
    order: 4,
    shouldGenerate: () => true,
  },
  {
    type: "trend_analysis",
    title: "Trend Analysis",
    order: 5,
    shouldGenerate: (input) => !!input.previousCrawl,
  },
  {
    type: "competitive_positioning",
    title: "Competitive Positioning",
    order: 6,
    shouldGenerate: (input) =>
      !!input.competitors && input.competitors.length > 0,
  },
  {
    type: "priority_recommendations",
    title: "Priority Recommendations",
    order: 7,
    shouldGenerate: () => true,
  },
];

export function getApplicableSections(input: NarrativeInput): SectionConfig[] {
  return SECTION_CONFIGS.filter((c) => c.shouldGenerate(input));
}

export async function generateSection(
  client: Anthropic,
  config: SectionConfig,
  input: NarrativeInput,
  model: string,
  resolvedPrompt?: NarrativeResolvedPrompt,
): Promise<{ section: NarrativeSection; tokenUsage: TokenUsage }> {
  const dataContext = selectDataForSection(config.type, input);
  const toneAdapter = getToneAdapter(input.tone);

  const userPrompt =
    resolvedPrompt?.user ??
    `${SECTION_PROMPTS[config.type]}

Here is the data for your analysis:

${JSON.stringify(dataContext, null, 2)}`;

  const response = await client.messages.create({
    model: resolvedPrompt?.model ?? model,
    max_tokens: resolvedPrompt?.maxTokens ?? 1024,
    system: resolvedPrompt?.system ?? `${BASE_SYSTEM_PROMPT}\n\n${toneAdapter}`,
    messages: [{ role: "user", content: userPrompt }],
    ...(resolvedPrompt?.temperature != null
      ? { temperature: resolvedPrompt.temperature }
      : {}),
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Reject an empty/non-text section instead of emitting empty content. The
  // caller uses allSettled, so this section is simply excluded from the
  // narrative rather than included blank.
  if (!content.trim()) {
    throw new Error(`Section ${config.type} returned empty content`);
  }

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  return {
    section: {
      id: crypto.randomUUID(),
      type: config.type,
      title: config.title,
      content,
      editedContent: null,
      order: config.order,
      dataContext,
    },
    tokenUsage: {
      input: inputTokens,
      output: outputTokens,
      costCents: calculateCost(model, inputTokens, outputTokens),
    },
  };
}
