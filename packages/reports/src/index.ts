export type {
  ReportData,
  ReportIssue,
  ReportROI,
  ReportQuickWin,
  ReportPageScore,
  ReportHistoryPoint,
  ReportVisibility,
  ReportCompetitor,
  ReportPlatformOpportunity,
  ReportContentHealth,
  ReportIntegrationData,
  ReportCoverageMetric,
  ReportActionPlanTier,
  ReportScoreDeltas,
  GenerateReportJob,
  ReportType,
  ReportFormat,
  GapQuery,
  PrioritizedAction,
  StructuredDataAnalysis,
  AICrawlerStatus,
  UnifiedReportData,
} from "./types";

export {
  aggregateReportData,
  computePrioritizedActions,
  type RawDbResults,
  type AggregateOptions,
} from "./data-aggregator";
export { fetchReportData } from "./data-fetcher";
export { estimateIssueROI } from "./roi";
export { aggregateCompetitors, type CompetitorAnalysis } from "./competitors";
export { aggregateIntegrations, type RawEnrichment } from "./integrations";
export { renderPdf } from "./pdf/render";
export { renderDocx } from "./docx/render";
