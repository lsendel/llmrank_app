export interface ProjectIntegration {
  id: string;
  projectId: string;
  provider: "gsc" | "psi" | "ga4" | "clarity" | "meta";
  enabled: boolean;
  hasCredentials: boolean;
  config: Record<string, unknown>;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationInsights {
  crawlId: string | null;
  crawlDate: string | null; // ISO 8601 timestamp
  integrations: {
    gsc: {
      topQueries: {
        query: string;
        impressions: number;
        clicks: number;
        position: number;
      }[];
      totalClicks: number;
      totalImpressions: number;
      indexedPages: { url: string; status: string }[];
    } | null;
    ga4: {
      bounceRate: number;
      avgEngagement: number;
      topPages: { url: string; sessions: number }[];
    } | null;
    clarity: {
      avgUxScore: number;
      rageClickPages: string[];
    } | null;
    meta: {
      totalShares: number;
      totalReactions: number;
      totalComments: number;
      topSocialPages: { url: string; engagement: number }[];
      adSummary: { spend: number; clicks: number; impressions: number } | null;
      topAdPages: { url: string; clicks: number; spend: number }[] | null;
    } | null;
    psi: {
      avgPerformanceScore: number;
      avgLcp: number | null;
      avgCls: number | null;
      avgFcp: number | null;
      cwvPassRate: number;
      pageScores: {
        url: string;
        score: number;
        lcp: number | null;
        cls: number | null;
      }[];
    } | null;
  } | null;
}
