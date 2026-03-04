export type ActionableAnomalyFilter =
  | "failed"
  | "stale"
  | "no_crawl"
  | "in_progress"
  | "low_score"
  | "manual_schedule"
  | "pipeline_disabled";

export interface AnomalySmartFixDraft {
  issueCode: string;
  status: "pending";
  severity: "critical" | "warning" | "info";
  category: "technical" | "content" | "ai_readiness" | "performance";
  scoreImpact: number;
  title: string;
  description: string;
  assigneeId?: string | null;
  dueAt?: string | null;
}

type SmartFixTemplate = Omit<
  AnomalySmartFixDraft,
  "title" | "description" | "assigneeId" | "dueAt"
> & {
  dueInDays: number;
  title: (projectLabel: string) => string;
  description: (projectLabel: string) => string;
};

const SMART_FIX_TEMPLATES: Record<ActionableAnomalyFilter, SmartFixTemplate> = {
  failed: {
    issueCode: "PORTFOLIO_CRAWL_FAILED_RECOVERY",
    status: "pending",
    severity: "critical",
    category: "technical",
    scoreImpact: 10,
    dueInDays: 2,
    title: (projectLabel) => `Recover failed crawl for ${projectLabel}`,
    description: (projectLabel) =>
      `Latest crawl failed for ${projectLabel}. Review blockers, re-run crawl, and verify stable completion.`,
  },
  stale: {
    issueCode: "PORTFOLIO_STALE_MONITORING_REFRESH",
    status: "pending",
    severity: "warning",
    category: "technical",
    scoreImpact: 7,
    dueInDays: 5,
    title: (projectLabel) =>
      `Refresh stale monitoring cadence for ${projectLabel}`,
    description: (projectLabel) =>
      `Crawl data is stale for ${projectLabel}. Trigger a new crawl and validate recurring schedule settings.`,
  },
  no_crawl: {
    issueCode: "PORTFOLIO_FIRST_CRAWL_BASELINE",
    status: "pending",
    severity: "warning",
    category: "technical",
    scoreImpact: 8,
    dueInDays: 2,
    title: (projectLabel) => `Run first crawl baseline for ${projectLabel}`,
    description: (projectLabel) =>
      `${projectLabel} has no crawl baseline yet. Run first crawl and capture score, issue, and visibility baseline.`,
  },
  in_progress: {
    issueCode: "PORTFOLIO_CRAWL_PROGRESS_REVIEW",
    status: "pending",
    severity: "info",
    category: "technical",
    scoreImpact: 3,
    dueInDays: 1,
    title: (projectLabel) => `Review active crawl progress for ${projectLabel}`,
    description: (projectLabel) =>
      `Crawl is currently in progress for ${projectLabel}. Confirm it advances normally and resolve stalls if needed.`,
  },
  low_score: {
    issueCode: "PORTFOLIO_LOW_SCORE_REMEDIATION",
    status: "pending",
    severity: "critical",
    category: "content",
    scoreImpact: 12,
    dueInDays: 4,
    title: (projectLabel) => `Launch low-score remediation for ${projectLabel}`,
    description: (projectLabel) =>
      `${projectLabel} is below target score threshold. Prioritize high-impact technical and content fixes this sprint.`,
  },
  manual_schedule: {
    issueCode: "PORTFOLIO_ENABLE_RECURRING_SCHEDULE",
    status: "pending",
    severity: "warning",
    category: "technical",
    scoreImpact: 6,
    dueInDays: 3,
    title: (projectLabel) =>
      `Enable recurring crawl schedule for ${projectLabel}`,
    description: (projectLabel) =>
      `${projectLabel} uses manual scheduling. Move to recurring cadence to reduce monitoring drift and manual overhead.`,
  },
  pipeline_disabled: {
    issueCode: "PORTFOLIO_ENABLE_PIPELINE_DEFAULTS",
    status: "pending",
    severity: "warning",
    category: "ai_readiness",
    scoreImpact: 7,
    dueInDays: 3,
    title: (projectLabel) =>
      `Enable post-crawl automation pipeline for ${projectLabel}`,
    description: (projectLabel) =>
      `Pipeline auto-run is disabled for ${projectLabel}. Re-enable automated remediation and visibility follow-up steps.`,
  },
};

function dueAtDaysFromNow(days: number): string {
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + days);
  due.setUTCHours(12, 0, 0, 0);
  return due.toISOString();
}

function projectLabel(projectName: string, domain: string): string {
  const trimmedName = projectName.trim();
  if (trimmedName.length > 0) return trimmedName;
  return domain.trim() || "project";
}

export function buildAnomalySmartFix(input: {
  anomaly: ActionableAnomalyFilter;
  projectName: string;
  domain: string;
  assigneeId?: string | null;
}): AnomalySmartFixDraft {
  const template = SMART_FIX_TEMPLATES[input.anomaly];
  const label = projectLabel(input.projectName, input.domain);

  return {
    issueCode: template.issueCode,
    status: template.status,
    severity: template.severity,
    category: template.category,
    scoreImpact: template.scoreImpact,
    title: template.title(label),
    description: template.description(label),
    assigneeId: input.assigneeId ?? null,
    dueAt: dueAtDaysFromNow(template.dueInDays),
  };
}
