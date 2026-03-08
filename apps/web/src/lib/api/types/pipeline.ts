export interface PipelineRecommendation {
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  action?: string;
}

export type PipelineRunStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export interface PipelineRun {
  id: string;
  status: PipelineRunStatus;
  currentStep: string | null;
  stepResults: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface PipelineHealthCheck {
  check: string;
  category: "technical" | "configuration" | "billing";
  status: "pass" | "warn" | "fail";
  message: string;
  autoFixable: boolean;
  suggestion?: string;
}

export interface PipelineHealthCheckResult {
  projectId: string;
  crawlJobId: string;
  checks: PipelineHealthCheck[];
  score: number;
}
