import type { CrawlJob } from "./crawls";

export interface Project {
  id: string;
  name: string;
  domain: string;
  createdAt: string;
  updatedAt: string;
  siteDescription?: string | null;
  industry?: string | null;
  faviconUrl?: string | null;
  analyticsSnippetEnabled?: boolean | null;
  settings: {
    maxPages: number;
    maxDepth: number;
    schedule: "manual" | "daily" | "weekly" | "monthly";
    ignoreRobots?: boolean;
    allowHttpFallback?: boolean;
  };
  branding?: { logoUrl?: string; companyName?: string; primaryColor?: string };
  pipelineSettings?: { autoRunOnCrawl?: boolean; skipSteps?: string[] };
  latestCrawl?: CrawlJob | null;
}

export interface CreateProjectInput {
  name: string;
  domain: string;
}

export interface UpdateProjectInput {
  name?: string;
  businessGoal?: "ai_mentions" | "lead_gen" | "outrank" | "brand_understanding";
  settings?: {
    maxPages?: number;
    maxDepth?: number;
    schedule?: "manual" | "daily" | "weekly" | "monthly";
    ignoreRobots?: boolean;
    allowHttpFallback?: boolean;
  };
  branding?: { logoUrl?: string; companyName?: string; primaryColor?: string };
  analyticsSnippetEnabled?: boolean;
}

export interface CategoryDelta {
  current: number;
  previous: number;
  delta: number;
}

export interface ChecklistData {
  visibilityCount: number;
  personaCount: number;
  reportCount: number;
  scheduleCount: number;
  actionItemCount: number;
}

export interface ProjectProgress {
  currentCrawlId: string;
  previousCrawlId: string;
  scoreDelta: number;
  currentScore: number;
  previousScore: number;
  categoryDeltas: {
    technical: CategoryDelta;
    content: CategoryDelta;
    aiReadiness: CategoryDelta;
    performance: CategoryDelta;
  };
  issuesFixed: number;
  issuesNew: number;
  issuesPersisting: number;
  gradeChanges: { improved: number; regressed: number; unchanged: number };
  velocity: number;
  topImprovedPages: Array<{ url: string; delta: number; current: number }>;
  topRegressedPages: Array<{ url: string; delta: number; current: number }>;
}
