import type { NarrativeSectionType } from "@llm-boost/shared";
import type { NarrativeInput } from "../types";
import { selectDataForSection } from "../utils/data-selector";
import { BASE_SYSTEM_PROMPT } from "./base-prompt";
import { SECTION_PROMPTS } from "./section-prompts";
import { getToneAdapter } from "./tone-adapters";

export interface NarrativePromptTemplate {
  system: string;
  user: string;
  model: string;
  config?: { maxTokens?: number; temperature?: number };
}

export interface NarrativeResolvedPrompt {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  promptId?: string | null;
}

export const NARRATIVE_PROMPT_SLUGS: Record<NarrativeSectionType, string> = {
  executive_summary: "narrative_executive_summary",
  technical_analysis: "narrative_technical_analysis",
  content_analysis: "narrative_content_analysis",
  ai_readiness_analysis: "narrative_ai_readiness_analysis",
  performance_analysis: "narrative_performance_analysis",
  trend_analysis: "narrative_trend_analysis",
  competitive_positioning: "narrative_competitive_positioning",
  priority_recommendations: "narrative_priority_recommendations",
};

const DEFAULT_NARRATIVE_MODEL = "claude-sonnet-4-6";

export function getNarrativePromptFallbacks(): Map<
  string,
  NarrativePromptTemplate
> {
  return new Map(
    (Object.keys(NARRATIVE_PROMPT_SLUGS) as NarrativeSectionType[]).map(
      (type) => [
        NARRATIVE_PROMPT_SLUGS[type],
        {
          system: `${BASE_SYSTEM_PROMPT}\n\n{{toneAdapter}}`,
          user: `${SECTION_PROMPTS[type]}\n\n{{reportData}}`,
          model: DEFAULT_NARRATIVE_MODEL,
          config: { maxTokens: 1024 },
        },
      ],
    ),
  );
}

export function buildNarrativePromptVariables(
  sectionType: NarrativeSectionType,
  input: NarrativeInput,
): Record<string, string> {
  const reportData = {
    sectionType,
    tone: input.tone,
    projectContext: input.projectContext ?? null,
    crawlSummary: input.crawlJob,
    categoryScores: input.categoryScores,
    sectionFocus: selectDataForSection(sectionType, input),
    issues: input.issues.slice(0, 20),
    quickWins: input.quickWins.slice(0, 10),
    contentHealth: input.contentHealth,
    trackedKeywords: input.trackedKeywords ?? [],
    trackedCompetitors: input.trackedCompetitors ?? [],
    personas: input.personas ?? [],
    previousCrawl: input.previousCrawl ?? null,
    competitors: input.competitors ?? [],
    topPages: input.pages.slice(0, 10),
  };

  return {
    reportData: JSON.stringify(reportData, null, 2),
    tone: input.tone,
    toneAdapter: getToneAdapter(input.tone),
    domain: input.crawlJob.domain,
    projectName: input.projectContext?.name ?? "",
    siteDescription: input.projectContext?.siteDescription ?? "",
    industry: input.projectContext?.industry ?? "",
    businessGoal: input.projectContext?.businessGoal ?? "",
  };
}
