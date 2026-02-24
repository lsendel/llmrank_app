"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StateMessage } from "@/components/ui/state";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  type PipelineHealthCheckResult,
  type PipelineRun,
  type PipelineRunStatus,
} from "@/lib/api";

function statusClasses(status: PipelineRunStatus): string {
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

function extractFailedSteps(run: PipelineRun | null): Array<{
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

function isRunSuccessful(run: PipelineRun): boolean {
  return run.status === "completed" && extractFailedSteps(run).length === 0;
}

export function AutomationTab({ projectId }: { projectId: string }) {
  const [isRerunning, setIsRerunning] = useState(false);
  const [healthResult, setHealthResult] =
    useState<PipelineHealthCheckResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: latestRun, mutate: mutateLatest } = useApiSWR(
    `pipeline-latest-${projectId}`,
    useCallback(() => api.pipeline.latest(projectId), [projectId]),
  );

  const { data: runs, mutate: mutateRuns } = useApiSWR(
    `pipeline-runs-${projectId}`,
    useCallback(() => api.pipeline.list(projectId), [projectId]),
  );

  const failedSteps = useMemo(
    () => extractFailedSteps(latestRun ?? null),
    [latestRun],
  );
  const totalRuns = runs?.length ?? 0;
  const successfulRuns = runs?.filter(isRunSuccessful).length ?? 0;
  const failedRuns = (runs ?? []).filter((run) => !isRunSuccessful(run)).length;
  const successRate =
    totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;

  async function handleRerun() {
    setIsRerunning(true);
    setActionError(null);
    try {
      await api.projects.rerunAutoGeneration(projectId);
      await Promise.all([mutateLatest(), mutateRuns()]);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not rerun automation.",
      );
    } finally {
      setIsRerunning(false);
    }
  }

  async function handleHealthCheck() {
    setHealthLoading(true);
    setActionError(null);
    try {
      const result = await api.pipeline.healthCheck(projectId);
      setHealthResult(result);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not run health check.",
      );
    } finally {
      setHealthLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Automation Status</CardTitle>
            <p className="text-sm text-muted-foreground">
              Post-crawl intelligence runs automatically. You can rerun it at
              any time.
            </p>
          </div>
          <span
            className={`rounded px-2 py-1 text-xs font-medium uppercase ${
              latestRun
                ? statusClasses(latestRun.status)
                : "bg-muted text-muted-foreground"
            }`}
          >
            {latestRun?.status ?? "pending"}
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Total Runs" value={String(totalRuns)} />
            <MetricCard label="Success Rate" value={`${successRate}%`} />
            <MetricCard label="Failed Runs" value={String(failedRuns)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleRerun}
              disabled={isRerunning || latestRun?.status === "running"}
            >
              {isRerunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Pipeline Now
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleHealthCheck}
              disabled={healthLoading}
            >
              {healthLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Check...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Run Health Check
                </>
              )}
            </Button>
          </div>

          {latestRun?.currentStep && (
            <p className="text-xs text-muted-foreground">
              Current step:{" "}
              <span className="font-medium">{latestRun.currentStep}</span>
            </p>
          )}

          {actionError && (
            <StateMessage
              variant="error"
              title="Automation action failed"
              description={actionError}
              compact
              className="rounded-md border border-destructive/20 bg-destructive/5 px-3"
            />
          )}
        </CardContent>
      </Card>

      {failedSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest Failed Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {failedSteps.map((step) => (
              <div
                key={step.step}
                className="rounded-md border border-red-200 bg-red-50 p-3"
              >
                <p className="text-sm font-medium text-red-800">{step.step}</p>
                <p className="mt-1 text-xs text-red-700">{step.error}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {healthResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Health Check Score: {healthResult.score}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {healthResult.checks.map((check) => (
              <div
                key={check.check}
                className="flex items-start gap-2 rounded-md border p-3"
              >
                {check.status === "pass" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                ) : check.status === "warn" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 text-red-600" />
                )}
                <div>
                  <p className="text-sm font-medium">{check.message}</p>
                  {check.suggestion && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Suggestion: {check.suggestion}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {!runs || runs.length === 0 ? (
            <StateMessage
              variant="empty"
              description="No pipeline runs yet. Start your first crawl to begin automation."
              compact
            />
          ) : (
            <div className="space-y-2">
              {runs.slice(0, 8).map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{run.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(run.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium uppercase ${statusClasses(run.status)}`}
                  >
                    {run.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
