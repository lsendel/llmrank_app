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
  GenerateReportJob,
  ReportType,
  ReportFormat,
  GapQuery,
} from "./types";

export {
  aggregateReportData,
  type RawDbResults,
  type AggregateOptions,
} from "./data-aggregator";
export { estimateIssueROI } from "./roi";
export { aggregateCompetitors, type CompetitorAnalysis } from "./competitors";
export { aggregateIntegrations, type RawEnrichment } from "./integrations";
export { renderPdf } from "./pdf/render";
export { renderDocx } from "./docx/render";
