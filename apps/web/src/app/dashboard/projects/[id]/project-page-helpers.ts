import {
  normalizeProjectTab,
  projectTabGroup,
  type ProjectTab,
  type ProjectTabGroup,
} from "./tab-state";

export const INTEGRATION_PROVIDERS = ["gsc", "psi", "ga4", "clarity"] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export function asIntegrationProvider(
  value: string | null,
): IntegrationProvider | null {
  if (!value) return null;
  return (INTEGRATION_PROVIDERS as readonly string[]).includes(value)
    ? (value as IntegrationProvider)
    : null;
}

export const INTEGRATION_LABELS: Record<IntegrationProvider, string> = {
  gsc: "Google Search Console",
  ga4: "Google Analytics 4",
  psi: "PageSpeed Insights",
  clarity: "Microsoft Clarity",
};

export const VISIBILITY_MODES = [
  "visibility",
  "ai-visibility",
  "ai-analysis",
] as const;
export type VisibilityMode = (typeof VISIBILITY_MODES)[number];

export type VisibilityGuidanceAction =
  | "open-search-visibility"
  | "open-ai-visibility"
  | "open-ai-analysis"
  | "open-automation-defaults"
  | "run-crawl";

export const VISIBILITY_GUIDANCE_ORDER: VisibilityMode[] = [
  "visibility",
  "ai-visibility",
  "ai-analysis",
];

export const VISIBILITY_MODE_GUIDANCE: Record<
  VisibilityMode,
  {
    label: string;
    whenToUse: string;
    value: string;
    requiresCrawl?: boolean;
  }
> = {
  visibility: {
    label: "Search Visibility",
    whenToUse:
      "You need weekly share-of-voice, competitor movement, and region-aware trend tracking.",
    value:
      "Turns visibility checks into backlog-ready opportunities and confidence-scored coverage.",
  },
  "ai-visibility": {
    label: "AI Visibility",
    whenToUse:
      "You need provider-by-provider mention rate and keyword gap discovery across LLM engines.",
    value:
      "Shows where your brand is missing and lets you convert gaps into tracked keywords quickly.",
  },
  "ai-analysis": {
    label: "AI Analysis",
    whenToUse:
      "You need crawl-based narrative insights and prioritized recommendations for what to fix next.",
    value:
      "Translates crawl output into strategy guidance for content, technical SEO, and AI-readiness.",
    requiresCrawl: true,
  },
};

export function visibilityNextStepRecommendation(context: {
  hasCompletedCrawl: boolean;
  automationConfigured: boolean;
  issueCount: number;
}): {
  title: string;
  description: string;
  actionLabel: string;
  action: VisibilityGuidanceAction;
} {
  if (!context.hasCompletedCrawl) {
    return {
      title: "Run baseline crawl to unlock AI Analysis",
      description:
        "Start with one crawl so AI Analysis can generate insight-driven recommendations.",
      actionLabel: "Run crawl",
      action: "run-crawl",
    };
  }

  if (!context.automationConfigured) {
    return {
      title: "Enable recurring monitoring defaults",
      description:
        "Set crawl cadence and post-crawl automation so visibility updates happen without manual work.",
      actionLabel: "Open defaults",
      action: "open-automation-defaults",
    };
  }

  if (context.issueCount > 0) {
    return {
      title: `Review AI Analysis for your ${context.issueCount} open issues`,
      description:
        "Use narrative insights to prioritize the highest-impact fixes before the next crawl cycle.",
      actionLabel: "Open AI Analysis",
      action: "open-ai-analysis",
    };
  }

  return {
    title: "Expand coverage with AI Visibility",
    description:
      "Benchmark brand mention rate across providers and convert uncovered opportunities into tracked keywords.",
    actionLabel: "Open AI Visibility",
    action: "open-ai-visibility",
  };
}

export function isVisibilityMode(tab: ProjectTab): tab is VisibilityMode {
  return (VISIBILITY_MODES as readonly string[]).includes(tab);
}

export function asVisibilityMode(value: string | null): VisibilityMode | null {
  if (!value) return null;
  return (VISIBILITY_MODES as readonly string[]).includes(value)
    ? (value as VisibilityMode)
    : null;
}

const VISIBILITY_MODE_STORAGE_PREFIX = "llmrank:project:visibility-mode";
const WORKSPACE_LAST_TAB_STORAGE_PREFIX = "llmrank:project:workspace-last-tab";

export function visibilityModeStorageKey(projectId: string): string {
  return `${VISIBILITY_MODE_STORAGE_PREFIX}:${projectId}`;
}

export function workspaceLastTabStorageKey(
  projectId: string,
  workspace: ProjectTabGroup,
): string {
  return `${WORKSPACE_LAST_TAB_STORAGE_PREFIX}:${projectId}:${workspace}`;
}

export function parseWorkspaceStoredTab(
  rawTab: string | null,
  workspace: ProjectTabGroup,
): ProjectTab | null {
  if (!rawTab) return null;
  const normalized = normalizeProjectTab(rawTab);
  if (normalized !== rawTab) return null;
  return projectTabGroup(normalized) === workspace ? normalized : null;
}
