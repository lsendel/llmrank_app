export interface LogUpload {
  id: string;
  projectId: string;
  filename: string;
  totalRequests: number;
  crawlerRequests: number;
  uniqueIPs: number;
  summary: LogAnalysisSummary;
  createdAt: string;
}

export interface LogAnalysisSummary {
  totalRequests: number;
  crawlerRequests: number;
  uniqueIPs: number;
  botBreakdown: Array<{ bot: string; count: number }>;
  statusBreakdown: Array<{ status: number; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
}

export interface CrawlerTimelinePoint {
  timestamp: string;
  gptbot: number;
  claudebot: number;
  perplexitybot: number;
  googlebot: number;
  bingbot: number;
  other: number;
}
