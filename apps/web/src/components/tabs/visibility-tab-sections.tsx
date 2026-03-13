import { type ComponentProps, useState } from "react";
import { KeywordPicker } from "@/components/visibility/keyword-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StateMessage } from "@/components/ui/state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { relativeTimeLabel } from "@/lib/insight-metadata";
import type { ScheduledQuery, VisibilityCheck } from "@/lib/api";
import { CalendarClock, Clock, Pause, Play, Plus, Trash2 } from "lucide-react";
import {
  DEFAULT_PROVIDER_IDS,
  FREQUENCY_OPTIONS,
  PROVIDERS,
  REGIONS,
  type ProviderId,
  type ScheduleFrequency,
  type VisibilityIntent,
} from "./visibility-tab-helpers";
import {
  ScheduleSuggestionBanner,
  VisibilityAnalyzeGapsSection,
  VisibilityResultCard,
} from "./visibility-tab-analysis";
type VisibilityMeta = {
  checks: number;
  providerCount: number;
  queryCount: number;
  latestCheckedAt: string | null;
  confidence: {
    label: string;
    variant: ComponentProps<typeof Badge>["variant"];
  };
};

export function ScheduledChecksSection({
  schedules,
  scheduleError,
  onCreateSchedule,
  onToggleSchedule,
  onDeleteSchedule,
}: {
  schedules: ScheduledQuery[];
  scheduleError: string | null;
  onCreateSchedule: (data: {
    query: string;
    providers: string[];
    frequency: ScheduleFrequency;
  }) => Promise<void>;
  onToggleSchedule: (schedule: ScheduledQuery) => Promise<void>;
  onDeleteSchedule: (id: string) => Promise<void>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Scheduled Checks</CardTitle>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Schedule
              </Button>
            </DialogTrigger>
            <AddScheduleDialog
              error={scheduleError}
              onSubmit={async (data) => {
                await onCreateSchedule(data);
                setDialogOpen(false);
              }}
            />
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {schedules.length === 0 ? (
          <StateMessage
            variant="empty"
            title="No scheduled checks yet"
            description="Add a schedule to automatically monitor your visibility across LLM providers."
            icon={<Clock className="h-10 w-10 text-muted-foreground/50" />}
          />
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <ScheduleRow
                key={schedule.id}
                schedule={schedule}
                onToggle={() => onToggleSchedule(schedule)}
                onDelete={() => onDeleteSchedule(schedule.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleRow({
  schedule,
  onToggle,
  onDelete,
}: {
  schedule: ScheduledQuery;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try {
      await onToggle();
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium">{schedule.query}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {schedule.providers.map((provider) => (
            <Badge key={provider} variant="secondary" className="text-xs">
              {provider}
            </Badge>
          ))}
          <Badge
            variant={schedule.frequency === "weekly" ? "default" : "secondary"}
            className="text-xs"
          >
            {schedule.frequency}
          </Badge>
          {!schedule.enabled && (
            <Badge variant="destructive" className="text-xs">
              Paused
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {schedule.lastRunAt
            ? `Last run: ${new Date(schedule.lastRunAt).toLocaleString()}`
            : "Not yet run"}
          {" | "}
          Next: {new Date(schedule.nextRunAt).toLocaleString()}
        </p>
      </div>
      <div className="ml-3 flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          disabled={toggling}
          title={schedule.enabled ? "Pause schedule" : "Resume schedule"}
        >
          {schedule.enabled ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="text-destructive hover:text-destructive"
          title="Delete schedule"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function AddScheduleDialog({
  error,
  onSubmit,
}: {
  error: string | null;
  onSubmit: (data: {
    query: string;
    providers: string[];
    frequency: ScheduleFrequency;
  }) => Promise<void>;
}) {
  const [scheduleQuery, setScheduleQuery] = useState("");
  const [scheduleProviders, setScheduleProviders] =
    useState<string[]>(DEFAULT_PROVIDER_IDS);
  const [frequency, setFrequency] = useState<ScheduleFrequency>("weekly");
  const [submitting, setSubmitting] = useState(false);

  function toggleScheduleProvider(id: string) {
    setScheduleProviders((prev) =>
      prev.includes(id)
        ? prev.filter((provider) => provider !== id)
        : [...prev, id],
    );
  }

  async function handleSubmit() {
    if (!scheduleQuery.trim() || scheduleProviders.length === 0) return;
    setSubmitting(true);
    try {
      await onSubmit({
        query: scheduleQuery.trim(),
        providers: scheduleProviders,
        frequency,
      });
      setScheduleQuery("");
      setScheduleProviders(DEFAULT_PROVIDER_IDS);
      setFrequency("weekly");
    } catch {
      // Error is displayed via the error prop
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add Scheduled Visibility Check</DialogTitle>
        <DialogDescription>
          Automatically check your brand visibility across LLM providers on a
          recurring schedule.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="schedule-query">Search Query</Label>
          <Input
            id="schedule-query"
            placeholder='e.g. "best project management tools"'
            value={scheduleQuery}
            onChange={(event) => setScheduleQuery(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>LLM Providers</Label>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((provider) => (
              <Button
                key={provider.id}
                type="button"
                variant={
                  scheduleProviders.includes(provider.id)
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => toggleScheduleProvider(provider.id)}
              >
                {provider.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select
            value={frequency}
            onValueChange={(value) => setFrequency(value as ScheduleFrequency)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error && (
          <StateMessage
            variant="error"
            compact
            title="Schedule creation failed"
            description={error}
            className="rounded-md border border-destructive/20 bg-destructive/5 py-3"
          />
        )}
      </div>
      <DialogFooter>
        <Button
          onClick={handleSubmit}
          disabled={
            submitting ||
            !scheduleQuery.trim() ||
            scheduleProviders.length === 0
          }
        >
          {submitting ? "Creating..." : "Create Schedule"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

const EMPTY_SUB = () => () => {};

export function VisibilityRegionFilter({
  selectedRegion,
  canFilterRegion,
  onSelectRegion,
}: {
  selectedRegion: string;
  canFilterRegion: boolean;
  onSelectRegion: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div />
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Region:</span>
        <Select value={selectedRegion} onValueChange={onSelectRegion}>
          <SelectTrigger className="h-8 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REGIONS.map((region) => (
              <SelectItem
                key={region.value}
                value={region.value}
                disabled={region.value !== "all" && !canFilterRegion}
              >
                {region.label}
                {region.value !== "all" && !canFilterRegion && " (Pro)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function VisibilityFreshnessSummary({
  historyLoaded,
  visibilityMeta,
}: {
  historyLoaded: boolean;
  visibilityMeta: VisibilityMeta | null;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {!historyLoaded && (
            <Badge variant="secondary">Loading visibility freshness...</Badge>
          )}
          {historyLoaded && !visibilityMeta && (
            <Badge variant="secondary">
              Run your first visibility check to establish confidence
            </Badge>
          )}
          {historyLoaded && visibilityMeta && (
            <>
              <Badge variant="secondary">
                Last checked:{" "}
                {relativeTimeLabel(visibilityMeta.latestCheckedAt)}
              </Badge>
              <Badge variant="secondary">
                Checks sampled: {visibilityMeta.checks}
              </Badge>
              <Badge variant="secondary">
                Provider diversity: {visibilityMeta.providerCount}/
                {PROVIDERS.length}
              </Badge>
              <Badge variant="secondary">
                Query coverage: {visibilityMeta.queryCount}
              </Badge>
              <Badge variant={visibilityMeta.confidence.variant}>
                Confidence: {visibilityMeta.confidence.label}
              </Badge>
            </>
          )}
        </div>
        {historyLoaded && visibilityMeta && (
          <p className="text-xs text-muted-foreground">
            Confidence reflects repeated checks and source diversity.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function RunVisibilitySection({
  projectId,
  selectedKeywordIds,
  onKeywordSelectionChange,
  intent,
  onIntentChange,
  onApplyIntentPreset,
  onApplyBalancedPreset,
  onApplyAiSearchPreset,
  onApplyFullCoveragePreset,
  isProOrAbove,
  selectedProviders,
  onToggleProvider,
  error,
  onRunCheck,
  loading,
  results,
  schedules,
  onScheduleCreated,
  schedulesLoaded,
  scheduleError,
  onCreateSchedule,
  onToggleSchedule,
  onDeleteSchedule,
  historyLoaded,
  history,
}: {
  projectId: string;
  selectedKeywordIds: string[];
  onKeywordSelectionChange: (ids: string[]) => void;
  intent: VisibilityIntent;
  onIntentChange: (intent: VisibilityIntent) => void;
  onApplyIntentPreset: () => void;
  onApplyBalancedPreset: () => void;
  onApplyAiSearchPreset: () => void;
  onApplyFullCoveragePreset: () => void;
  isProOrAbove: boolean;
  selectedProviders: ProviderId[];
  onToggleProvider: (providerId: ProviderId) => void;
  error: string | null;
  onRunCheck: () => void;
  loading: boolean;
  results: VisibilityCheck[];
  schedules: ScheduledQuery[];
  onScheduleCreated: (schedule: ScheduledQuery) => void;
  schedulesLoaded: boolean;
  scheduleError: string | null;
  onCreateSchedule: (data: {
    query: string;
    providers: string[];
    frequency: ScheduleFrequency;
  }) => Promise<void>;
  onToggleSchedule: (schedule: ScheduledQuery) => Promise<void>;
  onDeleteSchedule: (id: string) => Promise<void>;
  historyLoaded: boolean;
  history: VisibilityCheck[];
}) {
  return (
    <>
      <KeywordPicker
        projectId={projectId}
        selectedIds={selectedKeywordIds}
        onSelectionChange={onKeywordSelectionChange}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run Visibility Check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Query Intent</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={intent}
                onValueChange={(value) =>
                  onIntentChange(value as VisibilityIntent)
                }
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discovery">Brand discovery</SelectItem>
                  <SelectItem value="comparison">
                    Competitor comparison
                  </SelectItem>
                  <SelectItem value="transactional">
                    Transactional evaluation
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onApplyIntentPreset}
              >
                Apply Recommended Set
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Recommendations vary by intent and plan tier.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onApplyBalancedPreset}
              >
                Balanced (Recommended)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onApplyAiSearchPreset}
              >
                AI Search Focus
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!isProOrAbove}
                onClick={onApplyFullCoveragePreset}
              >
                Full Coverage {isProOrAbove ? "" : "(Pro+)"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>LLM Providers</Label>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((provider) => (
                <Button
                  key={provider.id}
                  variant={
                    selectedProviders.includes(provider.id)
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => onToggleProvider(provider.id)}
                >
                  {provider.label}
                </Button>
              ))}
            </div>
          </div>

          {selectedKeywordIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedKeywordIds.length} quer
              {selectedKeywordIds.length === 1 ? "y" : "ies"} x{" "}
              {selectedProviders.length} provider
              {selectedProviders.length === 1 ? "" : "s"} ={" "}
              {selectedKeywordIds.length * selectedProviders.length} checks
            </p>
          )}

          {error && (
            <StateMessage
              variant="error"
              compact
              title="Visibility check failed"
              description={error}
              className="rounded-md border border-destructive/20 bg-destructive/5 py-3"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRunCheck}
                  disabled={
                    loading ||
                    selectedKeywordIds.length === 0 ||
                    selectedProviders.length === 0
                  }
                >
                  Retry
                </Button>
              }
            />
          )}

          <Button
            onClick={onRunCheck}
            disabled={loading || selectedKeywordIds.length === 0}
          >
            {loading ? "Checking..." : "Run Check"}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Results</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {results.map((result) => (
              <VisibilityResultCard key={result.id} check={result} />
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && schedules.length === 0 && (
        <ScheduleSuggestionBanner
          projectId={projectId}
          lastQuery={results[0]?.query ?? ""}
          lastProviders={selectedProviders}
          onCreated={onScheduleCreated}
        />
      )}

      {schedulesLoaded && (
        <ScheduledChecksSection
          schedules={schedules}
          scheduleError={scheduleError}
          onCreateSchedule={onCreateSchedule}
          onToggleSchedule={onToggleSchedule}
          onDeleteSchedule={onDeleteSchedule}
        />
      )}

      <VisibilityHistorySection
        historyLoaded={historyLoaded}
        history={history}
      />
    </>
  );
}

export function VisibilityHistorySection({
  historyLoaded,
  history,
}: {
  historyLoaded: boolean;
  history: VisibilityCheck[];
}) {
  if (!historyLoaded || history.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Previous Checks</h3>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Query</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Brand Mentioned</TableHead>
              <TableHead>URL Cited</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((check) => (
              <TableRow key={check.id}>
                <TableCell className="text-sm">
                  {new Date(check.checkedAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm">
                  {check.query}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{check.llmProvider}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={check.brandMentioned ? "success" : "destructive"}
                  >
                    {check.brandMentioned ? "Yes" : "No"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={check.urlCited ? "success" : "destructive"}>
                    {check.urlCited ? "Yes" : "No"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export { VisibilityAnalyzeGapsSection } from "./visibility-tab-analysis";
