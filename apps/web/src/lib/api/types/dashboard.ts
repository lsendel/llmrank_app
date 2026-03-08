import type { CrawlJob } from "./crawls";

export interface DashboardStats {
  totalProjects: number;
  totalCrawls: number;
  avgScore: number;
  creditsRemaining: number;
  creditsTotal: number;
  latestInsights: DashboardInsightSummary | null;
}

export interface DashboardInsightSummary {
  quickWins: DashboardQuickWin[];
  coverage: DashboardCoverageMetric[];
  scoreDeltas: DashboardScoreDeltas;
}

export interface DashboardScoreDeltas {
  overall: number;
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
}

export interface DashboardQuickWin {
  code: string;
  message: string;
  recommendation: string;
  pillar: string;
  owner: string;
  effort: string;
  scoreImpact: number;
  affectedPages: number;
}

export interface DashboardCoverageMetric {
  code: string;
  label: string;
  description: string;
  pillar: string;
  coveragePercent: number;
  affectedPages: number;
  totalPages: number;
}

export interface DashboardActivity extends CrawlJob {
  projectName: string;
  projectId: string;
  projectDomain?: string;
}

export interface PortfolioPriorityItem {
  id: string;
  projectId: string;
  projectName: string;
  projectDomain: string;
  priority: "critical" | "high" | "medium" | "low";
  category: "onboarding" | "issues" | "crawl" | "keywords" | "competitors";
  channel: "google" | "llm" | "both";
  title: string;
  description: string;
  reason: string;
  action: string;
  owner: string | null;
  dueDate: string;
  expectedImpact: "high" | "medium" | "low";
  impactScore: number;
  trendDelta: number;
  effort: "low" | "medium" | "high";
  freshness: { generatedAt: string; lastCrawlAt: string | null };
  source: { signals: string[]; confidence: number };
}
