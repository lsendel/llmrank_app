import type { PipelineRun, PipelineRunStatus } from "@/lib/api";

export const PIPELINE_STEPS = [
  {
    id: "site_description",
    label: "Site description",
    description: "Summarize your website context from fresh crawl data.",
  },
  {
    id: "personas",
    label: "Personas",
    description: "Generate and refresh audience personas.",
  },
  {
    id: "keywords",
    label: "Keywords",
    description: "Discover and refresh target keyword opportunities.",
  },
  {
    id: "competitors",
    label: "Competitors",
    description: "Discover competitor domains for your market.",
  },
  {
    id: "visibility_check",
    label: "Visibility check",
    description: "Run AI search visibility checks.",
  },
  {
    id: "content_optimization",
    label: "Content optimization",
    description: "Generate optimization opportunities for site pages.",
  },
  {
    id: "action_report",
    label: "Action report",
    description: "Build prioritized next actions from latest findings.",
  },
  {
    id: "health_check",
    label: "Health check",
    description: "Score automation readiness and flag blockers.",
  },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];

export const PIPELINE_STEP_IDS = PIPELINE_STEPS.map((step) => step.id);
const PIPELINE_STEP_SET = new Set<string>(PIPELINE_STEP_IDS);

export function normalizeKnownSkipSteps(value: unknown): PipelineStepId[] {
  if (!Array.isArray(value)) return [];
  const selected = new Set(
    value.filter(
      (step): step is PipelineStepId =>
        typeof step === "string" && PIPELINE_STEP_SET.has(step),
    ),
  );
  return PIPELINE_STEP_IDS.filter((id) => selected.has(id));
}

export function normalizeUnknownSkipSteps(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (step): step is string =>
      typeof step === "string" && !PIPELINE_STEP_SET.has(step),
  );
}

export function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

export function statusClasses(status: PipelineRunStatus): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "running":
      return "bg-blue-100 text-blue-800";
    case "failed":
      return "bg-red-100 text-red-800";
    case "paused":
      return "bg-amber-100 text-amber-800";
    case "pending":
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function extractFailedSteps(run: PipelineRun | null): Array<{
  step: string;
  error: string;
}> {
  if (!run?.stepResults || typeof run.stepResults !== "object") return [];

  return Object.entries(run.stepResults).flatMap(([step, value]) => {
    if (!value || typeof value !== "object") return [];

    const result = value as { status?: string; error?: string };
    if (result.status !== "failed") return [];
    return [{ step, error: result.error ?? "Step failed without details" }];
  });
}

export function isRunSuccessful(run: PipelineRun): boolean {
  return run.status === "completed" && extractFailedSteps(run).length === 0;
}
