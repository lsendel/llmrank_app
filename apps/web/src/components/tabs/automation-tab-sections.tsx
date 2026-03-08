import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { StateMessage } from "@/components/ui/state";
import type { PipelineHealthCheckResult, PipelineRun } from "@/lib/api";
import {
  PIPELINE_STEPS,
  statusClasses,
  type PipelineStepId,
} from "./automation-tab-helpers";
import { getPipelineRemediationTarget } from "./pipeline-remediation";

export function AutomationStatusSection({
  latestRun,
  totalRuns,
  successRate,
  failedRuns,
  isRerunning,
  healthLoading,
  actionError,
  retryDisabled,
  onRerun,
  onHealthCheck,
  onRetryAction,
}: {
  latestRun: PipelineRun | null | undefined;
  totalRuns: number;
  successRate: number;
  failedRuns: number;
  isRerunning: boolean;
  healthLoading: boolean;
  actionError: string | null;
  retryDisabled: boolean;
  onRerun: () => void;
  onHealthCheck: () => void;
  onRetryAction: () => void | Promise<void>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Automation Status</CardTitle>
          <p className="text-sm text-muted-foreground">
            Track pipeline health and run it manually when needed.
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
            onClick={onRerun}
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
            onClick={onHealthCheck}
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
            retry={{
              onClick: onRetryAction,
              label: "Retry action",
              disabled: retryDisabled,
            }}
            compact
            className="rounded-md border border-destructive/20 bg-destructive/5 px-3"
          />
        )}
      </CardContent>
    </Card>
  );
}

export function AutomationSettingsSection({
  settingsReady,
  autoRunOnCrawl,
  settingsControlsDisabled,
  skipSteps,
  savedUnknownSkipSteps,
  settingsError,
  settingsSaving,
  settingsDirty,
  onAutoRunChange,
  onToggleSkipStep,
  onReset,
  onSave,
}: {
  settingsReady: boolean;
  autoRunOnCrawl: boolean;
  settingsControlsDisabled: boolean;
  skipSteps: PipelineStepId[];
  savedUnknownSkipSteps: string[];
  settingsError: string | null;
  settingsSaving: boolean;
  settingsDirty: boolean;
  onAutoRunChange: (value: boolean) => void;
  onToggleSkipStep: (stepId: PipelineStepId) => void;
  onReset: () => void;
  onSave: () => void | Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pipeline Settings</CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure default pipeline behavior after each completed crawl.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!settingsReady && (
          <StateMessage
            variant="loading"
            description="Loading current pipeline defaults..."
            compact
          />
        )}
        <div className="flex items-start gap-3 rounded-md border p-3">
          <Checkbox
            id="auto-run-on-crawl"
            checked={autoRunOnCrawl}
            disabled={settingsControlsDisabled}
            onCheckedChange={(checked) => onAutoRunChange(checked === true)}
          />
          <div className="space-y-1">
            <Label htmlFor="auto-run-on-crawl" className="text-sm font-medium">
              Run pipeline automatically after crawl completion
            </Label>
            <p className="text-xs text-muted-foreground">
              Disable this if you only want manual pipeline runs.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Skip steps</p>
          <p className="text-xs text-muted-foreground">
            Checked steps are skipped for both automatic and manual runs.
          </p>
          <div className="space-y-2">
            {PIPELINE_STEPS.map((step) => {
              const inputId = `skip-step-${step.id}`;
              return (
                <div
                  key={step.id}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <Checkbox
                    id={inputId}
                    checked={skipSteps.includes(step.id)}
                    disabled={settingsControlsDisabled}
                    onCheckedChange={() => onToggleSkipStep(step.id)}
                  />
                  <div className="space-y-1">
                    <Label htmlFor={inputId} className="text-sm font-medium">
                      {step.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {savedUnknownSkipSteps.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Additional hidden skip rules will be preserved when you save.
          </p>
        )}

        {settingsError && (
          <StateMessage
            variant="error"
            title="Settings update failed"
            description={settingsError}
            retry={{
              onClick: onSave,
              label: "Retry save",
              disabled: settingsSaving || !settingsReady,
            }}
            compact
            className="rounded-md border border-destructive/20 bg-destructive/5 px-3"
          />
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            disabled={settingsControlsDisabled || !settingsDirty}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={settingsControlsDisabled || !settingsDirty}
          >
            {settingsSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AutomationFailedStepsSection({
  projectId,
  failedSteps,
}: {
  projectId: string;
  failedSteps: Array<{ step: string; error: string }>;
}) {
  if (failedSteps.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Latest Failed Steps</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {failedSteps.map((step) => {
          const remediationTarget = getPipelineRemediationTarget(
            projectId,
            step.step,
          );
          return (
            <div
              key={step.step}
              className="rounded-md border border-red-200 bg-red-50 p-3"
            >
              <p className="text-sm font-medium text-red-800">{step.step}</p>
              <p className="mt-1 text-xs text-red-700">{step.error}</p>
              <p className="mt-2 text-xs text-red-800/90">
                {remediationTarget.description}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={remediationTarget.href}>
                  Open {remediationTarget.label}
                </Link>
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function AutomationHealthSection({
  healthResult,
}: {
  healthResult: PipelineHealthCheckResult | null;
}) {
  if (!healthResult) {
    return null;
  }

  return (
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
  );
}

export function AutomationRecentRunsSection({
  runs,
}: {
  runs: PipelineRun[] | undefined;
}) {
  return (
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
