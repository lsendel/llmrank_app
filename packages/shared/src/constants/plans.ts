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
  scheduledQueries: number;
  notificationChannels: number;
  apiTokens: number;
  apiRateLimit: number; // requests per minute
  visibilityChecks: number;
  historyDays: number;
  apiAccess: boolean;
  integrations: string[];
  reportsPerMonth: number;
  reportTypes: ("summary" | "detailed")[];
  reportBranding: "none" | "logo" | "full";
  reportHistoryDepth: number;
  reportCompetitorSection: boolean;
  reportIntegrationData: boolean;
  fixesPerMonth: number;
  competitorsPerProject: number;
  keywordDiscoveryPerMonth: number;
  personasPerProject: number;
  savedKeywordsPerProject: number;
  customAvatarsPerMonth: number;
  personaRefinement: boolean;
}

export function resolveEffectivePlan(user: {
  plan: PlanTier;
  trialEndsAt?: Date | string | null;
}): PlanTier {
  if (user.trialEndsAt) {
    const expires =
      typeof user.trialEndsAt === "string"
        ? new Date(user.trialEndsAt)
        : user.trialEndsAt;
    if (expires > new Date()) return "pro";
  }
  return user.plan;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    pagesPerCrawl: 10,
    maxCrawlDepth: 2,
    crawlsPerMonth: 2,
    projects: 1,
    lighthousePages: 5,
    llmScoringTier: "basic",
    scheduledQueries: 0,
    notificationChannels: 1, // email only
    apiTokens: 0,
    apiRateLimit: 0,
    visibilityChecks: 3,
    historyDays: 30,
    apiAccess: false,
    integrations: [],
    reportsPerMonth: 1,
    reportTypes: ["summary"],
    reportBranding: "none",
    reportHistoryDepth: 1,
    reportCompetitorSection: false,
    reportIntegrationData: false,
    fixesPerMonth: 5,
    competitorsPerProject: 0,
    keywordDiscoveryPerMonth: 0,
    personasPerProject: 2,
    savedKeywordsPerProject: 10,
    customAvatarsPerMonth: 0,
    personaRefinement: false,
  },
  starter: {
    pagesPerCrawl: 100,
    maxCrawlDepth: 3,
    crawlsPerMonth: 10,
    projects: 5,
    lighthousePages: "all",
    llmScoringTier: "full",
    scheduledQueries: 5,
    notificationChannels: 2, // email + 1 webhook
    apiTokens: 0,
    apiRateLimit: 100,
    visibilityChecks: 25,
    historyDays: 90,
    apiAccess: false,
    integrations: [],
    reportsPerMonth: 5,
    reportTypes: ["summary", "detailed"],
    reportBranding: "none",
    reportHistoryDepth: 3,
    reportCompetitorSection: true,
    reportIntegrationData: false,
    fixesPerMonth: 50,
    competitorsPerProject: 3,
    keywordDiscoveryPerMonth: 1,
    personasPerProject: 5,
    savedKeywordsPerProject: 50,
    customAvatarsPerMonth: 0,
    personaRefinement: true,
  },
  pro: {
    pagesPerCrawl: 500,
    maxCrawlDepth: 5,
    crawlsPerMonth: 30,
    projects: 20,
    lighthousePages: "all",
    llmScoringTier: "full",
    scheduledQueries: 25,
    notificationChannels: 999, // unlimited
    apiTokens: 3,
    apiRateLimit: 500,
    visibilityChecks: 100,
    historyDays: 365,
    apiAccess: true,
    integrations: ["gsc", "psi"],
    reportsPerMonth: 20,
    reportTypes: ["summary", "detailed"],
    reportBranding: "logo",
    reportHistoryDepth: 10,
    reportCompetitorSection: true,
    reportIntegrationData: true,
    fixesPerMonth: 200,
    competitorsPerProject: 5,
    keywordDiscoveryPerMonth: 3,
    personasPerProject: 15,
    savedKeywordsPerProject: 200,
    customAvatarsPerMonth: 5,
    personaRefinement: true,
  },
  agency: {
    pagesPerCrawl: 2000,
    maxCrawlDepth: 10,
    crawlsPerMonth: Infinity,
    projects: 50,
    lighthousePages: "all",
    llmScoringTier: "full_custom",
    scheduledQueries: 100,
    notificationChannels: 999, // unlimited
    apiTokens: 10,
    apiRateLimit: 2000,
    visibilityChecks: 500,
    historyDays: 730,
    apiAccess: true,
    integrations: ["gsc", "psi", "ga4", "clarity"],
    reportsPerMonth: Infinity,
    reportTypes: ["summary", "detailed"],
    reportBranding: "full",
    reportHistoryDepth: Infinity,
    reportCompetitorSection: true,
    reportIntegrationData: true,
    fixesPerMonth: Infinity,
    competitorsPerProject: 10,
    keywordDiscoveryPerMonth: 10,
    personasPerProject: 999,
    savedKeywordsPerProject: 999,
    customAvatarsPerMonth: 999,
    personaRefinement: true,
  },
};
