export const PlanTier = {
  FREE: "free",
  STARTER: "starter",
  PRO: "pro",
  AGENCY: "agency",
} as const;

export type PlanTier = (typeof PlanTier)[keyof typeof PlanTier];

export interface PlanLimits {
  pagesPerCrawl: number;
  maxCrawlDepth: number;
  crawlsPerMonth: number;
  projects: number;
  lighthousePages: number | "all";
  llmScoringTier: "basic" | "full" | "full_custom";
  visibilityChecks: number;
  historyDays: number;
  apiAccess: boolean;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    pagesPerCrawl: 10,
    maxCrawlDepth: 2,
    crawlsPerMonth: 2,
    projects: 1,
    lighthousePages: 5,
    llmScoringTier: "basic",
    visibilityChecks: 3,
    historyDays: 30,
    apiAccess: false,
  },
  starter: {
    pagesPerCrawl: 100,
    maxCrawlDepth: 3,
    crawlsPerMonth: 10,
    projects: 5,
    lighthousePages: "all",
    llmScoringTier: "full",
    visibilityChecks: 25,
    historyDays: 90,
    apiAccess: false,
  },
  pro: {
    pagesPerCrawl: 500,
    maxCrawlDepth: 5,
    crawlsPerMonth: 30,
    projects: 20,
    lighthousePages: "all",
    llmScoringTier: "full",
    visibilityChecks: 100,
    historyDays: 365,
    apiAccess: true,
  },
  agency: {
    pagesPerCrawl: 2000,
    maxCrawlDepth: 10,
    crawlsPerMonth: Infinity,
    projects: 50,
    lighthousePages: "all",
    llmScoringTier: "full_custom",
    visibilityChecks: 500,
    historyDays: 730,
    apiAccess: true,
  },
};
