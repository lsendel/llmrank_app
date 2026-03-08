export interface VisibilityCheck {
  id: string;
  projectId: string;
  pageId?: string;
  llmProvider:
    | "chatgpt"
    | "claude"
    | "perplexity"
    | "gemini"
    | "copilot"
    | "gemini_ai_mode"
    | "grok";
  query: string;
  keywordId?: string | null;
  responseText: string | null;
  brandMentioned: boolean;
  urlCited: boolean;
  citationPosition: number | null;
  competitorMentions:
    | {
        domain: string;
        mentioned: boolean;
        position: number | null;
      }[]
    | null;
  checkedAt: string;
}

export interface VisibilityTrend {
  weekStart: string;
  provider: string;
  mentionRate: number;
  citationRate: number;
  totalChecks: number;
}

export interface VisibilityGap {
  query: string;
  providers: string[];
  userMentioned: boolean;
  userCited: boolean;
  competitorsCited: Array<{ domain: string; position: number | null }>;
}

export interface CitedPage {
  citedUrl: string;
  citationCount: number;
  providers: string[];
  avgPosition: number;
  lastCited: string;
}

export interface SourceOpportunity {
  domain: string;
  mentionCount: number;
  queries: string[];
}

export interface AIScoreTrend {
  current: {
    overall: number;
    grade: "A" | "B" | "C" | "D" | "F";
    breakdown: {
      llmMentions: number;
      aiSearch: number;
      shareOfVoice: number;
      backlinkAuthority: number;
    };
  };
  previous: {
    overall: number;
    grade: "A" | "B" | "C" | "D" | "F";
    breakdown: {
      llmMentions: number;
      aiSearch: number;
      shareOfVoice: number;
      backlinkAuthority: number;
    };
  } | null;
  delta: number;
  direction: "up" | "down" | "stable";
  period: string;
  meta: {
    currentChecks: number;
    previousChecks: number;
    referringDomains: number;
    estimatedMonthlyAudience: number;
    audienceGrowth: number;
  };
}

export interface VisibilityRecommendation {
  type: "gap" | "platform" | "issue" | "trend" | "coverage";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  provider?: string;
  fixUrl?: string;
}

export interface ScheduledQuery {
  id: string;
  projectId: string;
  query: string;
  providers: string[];
  frequency: "hourly" | "daily" | "weekly";
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string;
  createdAt: string;
}

export interface CreateScheduleInput {
  projectId: string;
  query: string;
  providers: string[];
  frequency: "hourly" | "daily" | "weekly";
}

export interface ScheduleUpdate {
  query: string;
  providers: string[];
  frequency: "hourly" | "daily" | "weekly";
  enabled: boolean;
}
